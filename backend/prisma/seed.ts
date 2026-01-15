import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding...');

  // 1. Tenant Config (ENABLE STOCK!)
  await prisma.tenantConfig.upsert({
    where: { id: 1 },
    update: {
      enableStock: true, // IMPORTANT for testing stock logic
      enableDelivery: false, // FROZEN: Delivery module incomplete for MVP
    },
    create: {
      businessName: 'Pentium Bar',
      enableStock: true,
      enableDelivery: false, // FROZEN: Delivery module incomplete for MVP
      enableKDS: true,
      currencySymbol: '$'
    },
  });
  console.log('✅ Tenant Config');

  // 2. Roles with RBAC permissions
  const roles = [
    { 
      name: 'ADMIN', 
      permissions: { 
        orders: ['create', 'read', 'update', 'delete'],
        products: ['create', 'read', 'update', 'delete'],
        tables: ['create', 'read', 'update', 'delete'],
        cash: ['create', 'read', 'update', 'delete'],
        users: ['create', 'read', 'update', 'delete'],
        config: ['read', 'update']
      } 
    },
    { 
      name: 'CASHIER', 
      permissions: { 
        orders: ['create', 'read'],
        cash: ['read', 'update'] // Can view and close shifts
      } 
    },
    { 
      name: 'WAITER', 
      permissions: { 
        orders: ['create', 'read', 'update'],
        tables: ['read', 'update']
      } 
    },
    { 
      name: 'KITCHEN', 
      permissions: { 
        orders: ['read', 'update'] // Can see and update status
      } 
    },
    { 
      name: 'DELIVERY', 
      permissions: { 
        orders: ['read', 'update'] // Can see and update delivery status
      } 
    },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions }, // Force update permissions
      create: r,
    });
  }
  console.log('✅ Roles');

  // 3. Users
  const passwordHash = await bcrypt.hash('123456', 10);
  const users = [
    { name: 'Admin', email: 'admin@pentium.com', pin: '999999', role: 'ADMIN' },
    { name: 'Cajero', email: 'cajero@pentium.com', pin: '1111', role: 'CASHIER' },
    { name: 'Mozo', email: 'mozo@pentium.com', pin: '2222', role: 'WAITER' },
    { name: 'Cocinero', email: 'cocina@pentium.com', pin: '3333', role: 'KITCHEN' },
    { name: 'Repartidor', email: 'moto@pentium.com', pin: '4444', role: 'DELIVERY' },
  ];

  for (const u of users) {
    const role = await prisma.role.findUnique({ where: { name: u.role } });
    if (!role) continue;

    await prisma.user.upsert({
      where: { email: u.email },
      update: { pinCode: u.pin, roleId: role.id },
      create: {
        name: u.name,
        email: u.email,
        pinCode: u.pin, // 4-6 digits
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
    const cat = await prisma.category.upsert({
      where: { id: -1 }, // Hack to force create or find by unique if we had one (Name is not unique in schema?)
      // Actually schema doesn't make name unique for Category. Let's findFirst
      update: {},
      create: { name: c.name },
    });
    // Since upsert needs unique, and name isn't unique, we should check existence
    const existing = await prisma.category.findFirst({ where: { name: c.name } });
    if (existing) {
        categoriesMap.set(c.name, existing.id);
    } else {
        const newCat = await prisma.category.create({ data: { name: c.name }});
        categoriesMap.set(c.name, newCat.id);
    }
  }
  console.log('✅ Categories');

  // 5. Ingredients (Inventory)
  // Clean start for simple seeding logic if needed, but upsert is safer.
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
    let dbIng = await prisma.ingredient.findFirst({ where: { name: ing.name } });
    
    if (!dbIng) {
        dbIng = await prisma.ingredient.create({
            data: {
                name: ing.name,
                unit: ing.unit,
                cost: ing.cost,
                stock: 0, // Initial 0, we add stock movement next
            }
        });
        
        // Initial Stock Movement (PURCHASE)
        await prisma.stockMovement.create({
            data: {
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

      let product = await prisma.product.findFirst({ where: { name: p.name } });
      if (!product) {
          product = await prisma.product.create({
              data: {
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
