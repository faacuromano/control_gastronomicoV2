import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding...');

  // 0. Ensure Default Tenant Exists
  const tenantId = 1;
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'Default Tenant',
      code: 'default'
    }
  });
  console.log('✅ Default Tenant');

  // 1. Tenant Config
  await prisma.tenantConfig.upsert({
    where: { id: 1 },
    update: {
      tenantId,
      enableStock: true,
      enableDelivery: true, // ENABLED for testing
    },
    create: {
      tenantId,
      businessName: 'Pentium Bar',
      enableStock: true,
      enableDelivery: true, // ENABLED for testing
      enableKDS: true,
      currencySymbol: '$'
    },
  });
  console.log('✅ Tenant Config');

  // 2. Roles with RBAC permissions
  // Modules: pos, tables, cash, kds, delivery, admin (need 'access' to see in Header)
  // Resources: products, categories, orders, stock, users, etc (CRUD operations)
  const roles = [
    { 
      name: 'ADMIN', 
      permissions: { 
        // ADMIN gets everything via bypass, but we still define defaults
        pos: ['access', 'create', 'read', 'update', 'delete'],
        tables: ['access', 'create', 'read', 'update', 'delete'],
        cash: ['access', 'create', 'read', 'update', 'delete'],
        kds: ['access'],
        delivery: ['access'],
        admin: ['access'],
        orders: ['create', 'read', 'update', 'delete'],
        products: ['create', 'read', 'update', 'delete'],
        users: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update']
      } 
    },
    { 
      name: 'CASHIER', 
      permissions: { 
        pos: ['access', 'create', 'read'],
        cash: ['access', 'read', 'update'],
        tables: ['access', 'read'],
        orders: ['create', 'read']
      } 
    },
    { 
      name: 'WAITER', 
      permissions: { 
        pos: ['access', 'create', 'read', 'update'],
        tables: ['access', 'read', 'update'],
        orders: ['create', 'read', 'update']
      } 
    },
    { 
      name: 'KITCHEN', 
      permissions: { 
        kds: ['access'],
        orders: ['read', 'update']
      } 
    },
    { 
      name: 'DELIVERY', 
      permissions: { 
        delivery: ['access'],
        orders: ['read', 'update']
      } 
    },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { 
        tenantId_name: {
            tenantId,
            name: r.name 
        }
      },
      update: { permissions: r.permissions }, // Force update permissions
      create: { ...r, tenantId },
    });
  }
  console.log('✅ Roles');

  // 3. Users (PINs must be 6 digits as required by auth validation)
  const passwordHash = await bcrypt.hash('123456', 10);
  const users = [
    { name: 'Admin', email: 'admin@pentium.com', pin: process.env.SEED_ADMIN_PIN || '999999', role: 'ADMIN' },
    { name: 'Cajero', email: 'cajero@pentium.com', pin: '111111', role: 'CASHIER' },
    { name: 'Mozo', email: 'mozo@pentium.com', pin: '222222', role: 'WAITER' },
    { name: 'Cocinero', email: 'cocina@pentium.com', pin: '333333', role: 'KITCHEN' },
    { name: 'Repartidor', email: 'moto@pentium.com', pin: '444444', role: 'DELIVERY' },
  ];

  for (const u of users) {
    // FIX: Find first role by name within tenant (or safely findFirst)
    const role = await prisma.role.findFirst({ 
        where: { 
            name: u.role,
            tenantId
        } 
    });
    if (!role) continue;

    // SECURITY: Hash PIN before storing
    const pinHash = await bcrypt.hash(u.pin, 10);

    await prisma.user.upsert({
      where: {
        tenantId_email: {
            tenantId,
            email: u.email
        }
      },
      update: { pinHash, roleId: role.id },
      create: {
        tenantId,
        name: u.name,
        email: u.email,
        pinHash,
        passwordHash,
        roleId: role.id,
        isActive: true,
      },
    });
  }
  console.log('✅ Users');

  // 4. Categories
  const categoriesData = [
    { name: 'Hamburguesas' },
    { name: 'Pizzas' },
    { name: 'Bebidas' },
    { name: 'Guarniciones' },
  ];

  const categoriesMap = new Map();
  for (const c of categoriesData) {
    // FIX: Category name is not unique globally, and upsert needs unique.
    // Use findFirst + create/update logic manually or ensure id=-1 strategy works with tenantId? 
    // Easier: findFirst -> update OR create.
    
    let cat = await prisma.category.findFirst({ 
        where: { name: c.name, tenantId } 
    });

    if (cat) {
        // Update if needed
        categoriesMap.set(c.name, cat.id);
    } else {
        cat = await prisma.category.create({ 
            data: { name: c.name, tenantId }
        });
        categoriesMap.set(c.name, cat.id);
    }
  }
  console.log('✅ Categories');

  // 5. Ingredients (Inventory)
  const ingredientsData = [
    // Burger ingredients
    { name: 'Pan de Burger', unit: 'u', cost: 0.50, stock: 100 },
    { name: 'Carne 180g', unit: 'u', cost: 1.50, stock: 100 },
    { name: 'Queso Cheddar', unit: 'feta', cost: 0.20, stock: 200 },
    { name: 'Bacon', unit: 'feta', cost: 0.30, stock: 200 },
    // Pizza ingredients
    { name: 'Masa Pizza', unit: 'u', cost: 0.80, stock: 50 },
    { name: 'Queso Muzzarella', unit: 'g', cost: 0.01, stock: 5000 }, // 5kg
    { name: 'Salsa Tomate', unit: 'ml', cost: 0.005, stock: 5000 },
    // Drinks (Direct mapping)
    { name: 'Coca Cola 350ml', unit: 'u', cost: 0.80, stock: 200 },
    { name: 'Cerveza Lager', unit: 'u', cost: 1.00, stock: 200 },
    { name: 'Agua Mineral', unit: 'u', cost: 0.30, stock: 200 },
    // Sides
    { name: 'Papas Bastón', unit: 'kg', cost: 2.00, stock: 50 },
  ];

  const ingredientsMap = new Map();

  for (const ing of ingredientsData) {
    // Find first by name to avoid duplicates if name not unique constraint
    let dbIng = await prisma.ingredient.findFirst({ where: { name: ing.name, tenantId } });
    
    if (!dbIng) {
        dbIng = await prisma.ingredient.create({
            data: {
                tenantId,
                name: ing.name,
                unit: ing.unit,
                cost: ing.cost,
                stock: 0, // Initial 0, we add stock movement next
            }
        });
        
        // Initial Stock Movement (PURCHASE)
        await prisma.stockMovement.create({
            data: {
                tenantId,
                ingredientId: dbIng.id,
                type: 'PURCHASE',
                quantity: ing.stock,
            }
        });
        
        // Update stock in ingredient
        await prisma.ingredient.update({
            where: { id: dbIng.id },
            data: { stock: ing.stock }
        });
    }
    ingredientsMap.set(ing.name, dbIng.id);
  }
  console.log('✅ Ingredients & Inventory');

  // 6. Products & Recipes
  const productsData = [
    { 
        name: 'Burger Clásica', 
        price: 12.00, 
        cat: 'Hamburguesas',
        recipe: [
            { ing: 'Pan de Burger', qty: 1 },
            { ing: 'Carne 180g', qty: 1 },
            { ing: 'Queso Cheddar', qty: 2 }, // Double cheese
        ] 
    },
    { 
        name: 'Burger Bacon', 
        price: 14.50, 
        cat: 'Hamburguesas',
        recipe: [
            { ing: 'Pan de Burger', qty: 1 },
            { ing: 'Carne 180g', qty: 1 },
            { ing: 'Queso Cheddar', qty: 2 },
            { ing: 'Bacon', qty: 3 },
        ] 
    },
    { 
        name: 'Pizza Muzzarella', 
        price: 10.00, 
        cat: 'Pizzas',
        recipe: [
            { ing: 'Masa Pizza', qty: 1 },
            { ing: 'Queso Muzzarella', qty: 300 }, // 300g
            { ing: 'Salsa Tomate', qty: 100 }, // 100ml
        ] 
    },
    { 
        name: 'Coca Cola', 
        price: 3.00, 
        cat: 'Bebidas',
        recipe: [
            { ing: 'Coca Cola 350ml', qty: 1 },
        ] 
    },
    { 
        name: 'Cerveza', 
        price: 4.50, 
        cat: 'Bebidas',
        recipe: [
            { ing: 'Cerveza Lager', qty: 1 },
        ] 
    },
    { 
        name: 'Papas Fritas', 
        price: 5.00, 
        cat: 'Guarniciones',
        recipe: [
            { ing: 'Papas Bastón', qty: 0.4 }, // 400g portion
        ] 
    },
  ];

  for (const p of productsData) {
      const catId = categoriesMap.get(p.cat);
      if (!catId) continue;

      let product = await prisma.product.findFirst({ where: { name: p.name, tenantId } });
      if (!product) {
          product = await prisma.product.create({
              data: {
                  tenantId,
                  name: p.name,
                  price: p.price,
                  categoryId: catId,
                  productType: 'SIMPLE',
                  isStockable: true,
                  image: `https://ui-avatars.com/api/?name=${p.name.replace(' ', '+')}&background=random&size=256`
              }
          });

          // Create Recipe
          if (p.recipe) {
              for (const item of p.recipe) {
                  const ingId = ingredientsMap.get(item.ing);
                  if (ingId) {
                      await prisma.productIngredient.create({
                          data: {
                              tenantId,
                              productId: product.id,
                              ingredientId: ingId,
                              quantity: item.qty
                          }
                      });
                  }
              }
          }
      }
  }

  console.log('✅ Products & Recipes');

  // 6b. Modifiers
  console.log('🌱 Seeding Modifiers...');
  
  const modifierGroupsData = [
      { 
          name: 'Punto de Cocción', 
          min: 1, 
          max: 1, 
          options: [
              { name: 'Jugoso', price: 0 },
              { name: 'A Punto', price: 0 },
              { name: 'Cocido', price: 0 }
          ] 
      },
      { 
          name: 'Extras Burger', 
          min: 0, 
          max: 3, 
          options: [
              { name: 'Huevo Frito', price: 1.50 },
              { name: 'Bacon Extra', price: 2.00 },
              { name: 'Queso Extra', price: 1.00 },
              { name: 'Cebolla Caramelizada', price: 0.50 }
          ] 
      },
      {
          name: 'Opciones Bebida',
          min: 1,
          max: 1,
          options: [
              { name: 'Con Hielo', price: 0 },
              { name: 'Sin Hielo', price: 0 }
          ]
      }
  ];

  const modGroupsMap = new Map();

  for (const group of modifierGroupsData) {
      // Check if group exists
      const existingGroup = await prisma.modifierGroup.findFirst({
          where: { name: group.name, tenantId },
          include: { options: true }
      });
       
      if (!existingGroup) {
          // Create new group with options
          const newGroup = await prisma.modifierGroup.create({
            data: {
                tenantId,
                name: group.name,
                minSelection: group.min,
                maxSelection: group.max,
                options: {
                    create: group.options.map(o => ({
                        tenantId,
                        name: o.name,
                        priceOverlay: o.price
                    }))
                }
            },
            include: { options: true }
          });
          modGroupsMap.set(group.name, newGroup);
      } else {
          modGroupsMap.set(group.name, existingGroup);
      }
  }

  // Link Modifiers to Products
  const burgerProduct = await prisma.product.findFirst({ where: { name: 'Burger Clásica', tenantId } });
  const burgerBacon = await prisma.product.findFirst({ where: { name: 'Burger Bacon', tenantId } });
  const cocaCola = await prisma.product.findFirst({ where: { name: 'Coca Cola', tenantId } });

  const coccionGroup = modGroupsMap.get('Punto de Cocción');
  const extrasGroup = modGroupsMap.get('Extras Burger');
  const iceGroup = modGroupsMap.get('Opciones Bebida');

  if (burgerProduct && coccionGroup) {
      await prisma.productModifierGroup.createMany({
          data: [
              { tenantId, productId: burgerProduct.id, modifierGroupId: coccionGroup.id },
              { tenantId, productId: burgerProduct.id, modifierGroupId: extrasGroup.id }
          ],
          skipDuplicates: true
      });
  }

  if (burgerBacon && coccionGroup) {
      await prisma.productModifierGroup.createMany({
          data: [
               { tenantId, productId: burgerBacon.id, modifierGroupId: coccionGroup.id }
          ],
          skipDuplicates: true
      });
  }
  
  if (cocaCola && iceGroup) {
      await prisma.productModifierGroup.createMany({
          data: [
               { tenantId, productId: cocaCola.id, modifierGroupId: iceGroup.id }
          ],
          skipDuplicates: true
      });
  }
  
  console.log('✅ Modifiers Linked');

  // 7. Areas & Tables
  const mainArea = await prisma.area.upsert({
    where: { id: 1 },
    update: { name: 'Salón Principal', tenantId },
    create: { name: 'Salón Principal', tenantId }
  });

  const tablesData = [
    { name: 'Mesa 1', areaId: mainArea.id, x: 50, y: 50 },
    { name: 'Mesa 2', areaId: mainArea.id, x: 200, y: 50 },
    { name: 'Mesa 3', areaId: mainArea.id, x: 350, y: 50 },
    { name: 'Mesa 4', areaId: mainArea.id, x: 50, y: 200 },
    { name: 'Mesa 5', areaId: mainArea.id, x: 200, y: 200 },
  ];

  for (const t of tablesData) {
    const existing = await prisma.table.findFirst({ 
        where: { name: t.name, areaId: t.areaId, tenantId } 
    });
    if (!existing) {
      await prisma.table.create({ data: { ...t, tenantId } });
    }
  }
  console.log('✅ Areas & Tables');

  // 8. Open Cash Shift for testing
  const waiterUser = await prisma.user.findFirst({ where: { email: 'mozo@pentium.com', tenantId } });
  if (waiterUser) {
    const existingShift = await prisma.cashShift.findFirst({
      where: { userId: waiterUser.id, endTime: null, tenantId }
    });

    if (!existingShift) {
      await prisma.cashShift.create({
        data: {
          tenantId,
          userId: waiterUser.id,
          startAmount: 1000,
          businessDate: new Date(),
          startTime: new Date(),
        }
      });
      console.log('✅ Open Cash Shift');
    }
  }

  // 9. Test Orders for KDS
  const tables = await prisma.table.findMany({ where: { tenantId } });
  const products = await prisma.product.findMany({ 
      where: { tenantId },
      include: { ingredients: true } 
  });
  
  if (waiterUser && tables.length >= 3 && products.length > 0) {
    const table1 = tables[0]!;
    const table2 = tables[1]!;
    const table3 = tables[2]!;
    const burgerProduct = products.find(p => p.name.includes('Burger'));
    const pizzaProduct = products.find(p => p.name.includes('Pizza'));
    const drinkProduct = products.find(p => p.name.includes('Coca'));
    const friesProduct = products.find(p => p.name.includes('Papas'));

    // Order 1: Pending (New order just arrived)
    await prisma.order.create({
      data: {
        tenantId,
        orderNumber: 9001,
        channel: 'POS',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: burgerProduct ? Number(burgerProduct.price) * 2 : 0,
        total: burgerProduct ? Number(burgerProduct.price) * 2 : 0,
        businessDate: new Date(),
        tableId: table1.id,
        serverId: waiterUser.id,
        items: {
          create: burgerProduct ? [
            {
              tenantId,
              product: { connect: { id: burgerProduct.id } },
              quantity: 2,
              unitPrice: Number(burgerProduct.price),
              status: 'PENDING'
            }
          ] : []
        }
      }
    });

    // Order 2: In Preparation (Cooking)
    await prisma.order.create({
      data: {
        tenantId,
        orderNumber: 9002,
        channel: 'POS',
        status: 'IN_PREPARATION',
        paymentStatus: 'PAID',
        subtotal: pizzaProduct && drinkProduct ? Number(pizzaProduct.price) + Number(drinkProduct.price) * 2 : 0,
        total: pizzaProduct && drinkProduct ? Number(pizzaProduct.price) + Number(drinkProduct.price) * 2 : 0,
        businessDate: new Date(),
        tableId: table2.id,
        serverId: waiterUser.id,
        items: {
          create: [
            ...(pizzaProduct ? [{
              tenantId,
              product: { connect: { id: pizzaProduct.id } },
              quantity: 1,
              unitPrice: Number(pizzaProduct.price),
              status: 'COOKING' as const
            }] : []),
            ...(drinkProduct ? [{
              tenantId,
              product: { connect: { id: drinkProduct.id } },
              quantity: 2,
              unitPrice: Number(drinkProduct.price),
              status: 'READY' as const
            }] : [])
          ]
        }
      }
    });

    // Order 3: Ready (Completed)
    await prisma.order.create({
      data: {
        tenantId,
        orderNumber: 9003,
        channel: 'POS',
        status: 'PREPARED',
        paymentStatus: 'PAID',
        subtotal: friesProduct && burgerProduct ? Number(friesProduct.price) + Number(burgerProduct.price) : 0,
        total: friesProduct && burgerProduct ? Number(friesProduct.price) + Number(burgerProduct.price) : 0,
        businessDate: new Date(),
        tableId: table3.id,
        serverId: waiterUser.id,
        items: {
          create: [
            ...(friesProduct ? [{
              tenantId,
              product: { connect: { id: friesProduct.id } },
              quantity: 1,
              unitPrice: Number(friesProduct.price),
              status: 'READY' as const
            }] : []),
            ...(burgerProduct ? [{
              tenantId,
              product: { connect: { id: burgerProduct.id } },
              quantity: 1,
              unitPrice: Number(burgerProduct.price),
              status: 'READY' as const
            }] : [])
          ]
        }
      }
    });

    console.log('✅ Test Orders for KDS');
  }

  // 10. Initialize OrderSequence for robust numbering
  // Format: TENANT_1_DATE_YYYYMMDD
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const sequenceKey = `TENANT_${tenantId}_DATE_${yyyy}${mm}${dd}`;
  
  // Start from 9004 since we created test orders 9001-9003
  const existingSeq = await prisma.orderSequence.findFirst({ 
      where: { sequenceKey, tenantId } 
  });
  
  if (!existingSeq) {
    await prisma.orderSequence.create({
      data: {
        tenantId,
        sequenceKey,
        currentValue: 9003, // Next order will be 9004
      }
    });
    console.log(`✅ OrderSequence initialized for ${sequenceKey} (starting from 9004)`);
  }

  console.log('🚀 Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
