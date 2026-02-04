
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('🍗 Iniciando Seed: Rotisería Argentina...');
    console.log('📅 Fecha: 03/02/2026');

    // ============================================
    // 1. CREAR TENANT (Rotisería)
    // ============================================
    const tenantCode = 'rotiseria_demo';
    
    // Create or retrieve the tenant
    const tenant = await prisma.tenant.upsert({
        where: { code: tenantCode },
        update: {},
        create: {
            name: 'Rotisería El Buen Sabor',
            code: tenantCode,
            activeSubscription: true
        }
    });

    const tenantId = tenant.id;
    console.log(`✅ Tenant: ${tenant.name} (ID: ${tenantId})`);

    // ============================================
    // 2. CONFIGURACIÓN DEL NEGOCIO
    // ============================================
    // TenantConfig usually has a 1-to-1 relation with Tenant but schema uses tenantId FK on TenantConfig
    // Checking schema: TenantConfig has 'id' PK and 'tenantId' FK. Ideally unique on tenantId but schema index is not unique?
    // Let's check for existing config by tenantId first.
    
    const existingConfig = await prisma.tenantConfig.findFirst({ where: { tenantId } });
    
    if (!existingConfig) {
        await prisma.tenantConfig.create({
            data: {
                tenantId,
                businessName: 'Rotisería El Buen Sabor',
                enableStock: true,
                enableDelivery: true,
                enableKDS: true,
                currencySymbol: '$',
                defaultTaxRate: 0 // Monotributo implied
            }
        });
    } else {
        await prisma.tenantConfig.update({
            where: { id: existingConfig.id },
            data: {
                businessName: 'Rotisería El Buen Sabor',
                enableStock: true,
                enableDelivery: true
            }
        });
    }
    console.log('✅ Configuración del negocio');

    // ============================================
    // 3. ROLES (RBAC)
    // ============================================
    const roles = [
        { 
            name: 'ADMIN', 
            permissions: { 
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
            name: 'CAJERO', 
            permissions: { 
                pos: ['access', 'create', 'read'],
                cash: ['access', 'read', 'update'],
                tables: ['access', 'read'],
                orders: ['create', 'read'],
                delivery: ['access', 'read', 'update']
            } 
        },
        { 
            name: 'COCINERO', 
            permissions: { 
                kds: ['access'],
                orders: ['read', 'update']
            } 
        },
        { 
            name: 'REPARTIDOR', 
            permissions: { 
                delivery: ['access'],
                orders: ['read', 'update']
            } 
        },
    ];

    const rolesMap = new Map<string, number>();

    for (const r of roles) {
        const role = await prisma.role.upsert({
            where: { 
                tenantId_name: {
                    tenantId,
                    name: r.name
                }
             },
            update: { permissions: r.permissions },
            create: { ...r, tenantId },
        });
        rolesMap.set(r.name, role.id);
    }
    console.log('✅ Roles');

    // ============================================
    // 4. USUARIOS
    // ============================================
    const passwordHash = await bcrypt.hash('123456', 10);
    const users = [
        { name: 'Dueño', email: 'admin@rotiseria.com', pin: '999999', role: 'ADMIN' },
        { name: 'Cajera Susana', email: 'caja@rotiseria.com', pin: '111111', role: 'CAJERO' },
        { name: 'Cocinero Ramon', email: 'cocina@rotiseria.com', pin: '333333', role: 'COCINERO' },
        { name: 'Moto 1', email: 'moto1@rotiseria.com', pin: '444444', role: 'REPARTIDOR' },
    ];

    for (const u of users) {
        const roleId = rolesMap.get(u.role);
        if (!roleId) continue;

        const pinHash = await bcrypt.hash(u.pin, 10);

        await prisma.user.upsert({
            where: { 
                tenantId_email: {
                    tenantId,
                    email: u.email
                }
            },
            update: { pinHash, roleId, isActive: true },
            create: {
                tenantId,
                name: u.name,
                email: u.email,
                pinHash,
                passwordHash,
                roleId,
                isActive: true,
            },
        });
    }
    console.log('✅ Usuarios');

    // ============================================
    // 5. CATEGORÍAS
    // ============================================
    const categoriesData = [
        { name: 'Rotisería' }, // Pollo al spiedo, papas, tortillas
        { name: 'Minutas' },   // Milanesas, supremas
        { name: 'Empanadas' },
        { name: 'Pizzas' },
        { name: 'Sandwiches' }, // Sandwiches de mila
        { name: 'Bebidas' },
        { name: 'Promos' },
    ];

    const categoriesMap = new Map<string, number>();
    for (const c of categoriesData) {
        let existing = await prisma.category.findFirst({ where: { name: c.name, tenantId } });
        if (!existing) {
            existing = await prisma.category.create({ data: { name: c.name, tenantId } });
        }
        categoriesMap.set(c.name, existing.id);
    }
    console.log('✅ Categorías');

    // ============================================
    // 6. INGREDIENTES / INVENTARIO
    // Precios ARS Febrero 2026
    // ============================================
    const ingredientsData = [
        // Carnes
        { name: 'Pollo Entero Crudo', unit: 'u', cost: 4500, stock: 50 },
        { name: 'Carne para Milanesa (Nalga)', unit: 'kg', cost: 9500, stock: 30 },
        { name: 'Pechuga de Pollo', unit: 'kg', cost: 8000, stock: 30 },
        
        // Fiambres y Quesos
        { name: 'Queso Muzzarella', unit: 'kg', cost: 7000, stock: 50 },
        { name: 'Jamón Cocido', unit: 'kg', cost: 8500, stock: 20 },
        { name: 'Roquefort', unit: 'kg', cost: 12000, stock: 10 },
        
        // Verduras y Varios
        { name: 'Papa', unit: 'kg', cost: 1200, stock: 200 },
        { name: 'Cebolla', unit: 'kg', cost: 1000, stock: 50 },
        { name: 'Acelga', unit: 'kg', cost: 1500, stock: 30 },
        { name: 'Huevo', unit: 'u', cost: 150, stock: 500 },
        { name: 'Tomate', unit: 'kg', cost: 2000, stock: 30 },
        { name: 'Lechuga', unit: 'kg', cost: 2500, stock: 20 },
        
        // Panificados
        { name: 'Pan Sanguchero', unit: 'u', cost: 500, stock: 100 },
        { name: 'Masa Pizza', unit: 'u', cost: 800, stock: 50 },
        { name: 'Tapa de Empanada', unit: 'u', cost: 120, stock: 500 },
        { name: 'Pan Rallado', unit: 'kg', cost: 1800, stock: 50 },
        
        // Insumos
        { name: 'Aceite', unit: 'lts', cost: 2500, stock: 100 },
        
        // Bebidas (Reventa)
        { name: 'Coca Cola 1.5L', unit: 'u', cost: 2200, stock: 60 },
        { name: 'Coca Cola 500ml', unit: 'u', cost: 1000, stock: 100 },
        { name: 'Cerveza Quilmes 1L', unit: 'u', cost: 1800, stock: 120 },
        { name: 'Levite 1.5L', unit: 'u', cost: 1500, stock: 60 },
        { name: 'Soda Sifón', unit: 'u', cost: 1200, stock: 40 },
    ];

    const ingredientsMap = new Map<string, number>();

    for (const ing of ingredientsData) {
        let dbIng = await prisma.ingredient.findFirst({ where: { name: ing.name, tenantId } });
        
        if (!dbIng) {
            dbIng = await prisma.ingredient.create({
                data: {
                    tenantId,
                    name: ing.name,
                    unit: ing.unit,
                    cost: ing.cost,
                    stock: 0,
                }
            });
            
            // Stock inicial
            await prisma.stockMovement.create({
                data: {
                    tenantId,
                    ingredientId: dbIng.id,
                    type: 'PURCHASE',
                    quantity: ing.stock,
                    reason: 'Stock Inicial Seed'
                }
            });
            
            await prisma.ingredient.update({
                where: { id: dbIng.id },
                data: { stock: ing.stock }
            });
        }
        ingredientsMap.set(ing.name, dbIng.id);
    }
    console.log('✅ Ingredientes e Inventario');

    // ============================================
    // 7. PRODUCTOS Y RECETAS
    // ============================================
    const productsData = [
        // === ROTISERÍA ===
        { 
            name: 'Pollo al Spiedo con Papas', 
            price: 15000, 
            cat: 'Rotisería',
            recipe: [
                { ing: 'Pollo Entero Crudo', qty: 1 },
                { ing: 'Papa', qty: 0.8 }, // casi 1kg de papas crudas
            ]
        },
        { 
            name: 'Medio Pollo al Spiedo', 
            price: 8500, 
            cat: 'Rotisería',
            recipe: [
                { ing: 'Pollo Entero Crudo', qty: 0.5 },
            ]
        },
        { 
            name: 'Porción de Papas Fritas', 
            price: 5500, 
            cat: 'Rotisería',
            recipe: [
                { ing: 'Papa', qty: 0.5 },
                { ing: 'Aceite', qty: 0.05 },
            ]
        },
        { 
            name: 'Tortilla de Papa', 
            price: 6000, 
            cat: 'Rotisería',
            recipe: [
                { ing: 'Papa', qty: 0.4 },
                { ing: 'Huevo', qty: 4 },
                { ing: 'Cebolla', qty: 0.1 },
            ]
        },
        { 
            name: 'Tortilla de Acelga', 
            price: 6500, 
            cat: 'Rotisería',
            recipe: [
                { ing: 'Acelga', qty: 0.5 },
                { ing: 'Huevo', qty: 4 },
            ]
        },

        // === MINUTAS ===
        { 
            name: 'Milanesa c/ Fritas', 
            price: 10500, 
            cat: 'Minutas',
            recipe: [
                { ing: 'Carne para Milanesa (Nalga)', qty: 0.25 },
                { ing: 'Pan Rallado', qty: 0.1 },
                { ing: 'Huevo', qty: 1 },
                { ing: 'Papa', qty: 0.4 },
            ]
        },
        { 
            name: 'Milanesa Napolitana c/ Fritas', 
            price: 13500, 
            cat: 'Minutas',
            recipe: [
                { ing: 'Carne para Milanesa (Nalga)', qty: 0.25 },
                { ing: 'Pan Rallado', qty: 0.1 },
                { ing: 'Huevo', qty: 1 },
                { ing: 'Papa', qty: 0.4 },
                { ing: 'Queso Muzzarella', qty: 0.15 },
                { ing: 'Jamón Cocido', qty: 0.05 },
                { ing: 'Tomate', qty: 0.1 },
            ]
        },
        { 
            name: 'Suprema de Pollo c/ Fritas', 
            price: 9800, 
            cat: 'Minutas',
            recipe: [
                { ing: 'Pechuga de Pollo', qty: 0.3 },
                { ing: 'Papa', qty: 0.4 },
            ]
        },

        // === SANDWICHES ===
        { 
            name: 'Sandwich de Milanesa Completo', 
            price: 11000, 
            cat: 'Sandwiches',
            recipe: [
                { ing: 'Pan Sanguchero', qty: 1 },
                { ing: 'Carne para Milanesa (Nalga)', qty: 0.15 },
                { ing: 'Jamón Cocido', qty: 0.03 },
                { ing: 'Queso Muzzarella', qty: 0.03 },
                { ing: 'Huevo', qty: 1 },
                { ing: 'Lechuga', qty: 0.05 },
                { ing: 'Tomate', qty: 0.05 },
            ]
        },
        { 
            name: 'Sandwich de Milanesa Simple', 
            price: 8500, 
            cat: 'Sandwiches',
            recipe: [
                { ing: 'Pan Sanguchero', qty: 1 },
                { ing: 'Carne para Milanesa (Nalga)', qty: 0.15 },
            ]
        },

        // === EMPANADAS (por unidad) ===
        { name: 'Empanada Carne', price: 1200, cat: 'Empanadas', recipe: [{ing: 'Tapa de Empanada', qty:1}, {ing: 'Carne para Milanesa (Nalga)', qty: 0.05}] },
        { name: 'Empanada Pollo', price: 1200, cat: 'Empanadas', recipe: [{ing: 'Tapa de Empanada', qty:1}, {ing: 'Pechuga de Pollo', qty: 0.05}] },
        { name: 'Empanada JyQ', price: 1200, cat: 'Empanadas', recipe: [{ing: 'Tapa de Empanada', qty:1}, {ing: 'Jamón Cocido', qty: 0.02}, {ing: 'Queso Muzzarella', qty: 0.03}] },
        { name: 'Empanada Verdura', price: 1100, cat: 'Empanadas', recipe: [{ing: 'Tapa de Empanada', qty:1}, {ing: 'Acelga', qty: 0.05}] },
        { name: 'Empanada Roquefort', price: 1300, cat: 'Empanadas', recipe: [{ing: 'Tapa de Empanada', qty:1}, {ing: 'Roquefort', qty: 0.03}] },
        
        { 
            name: 'Docena Empanadas', 
            price: 12500, 
            cat: 'Empanadas',
            recipe: [
                {ing: 'Tapa de Empanada', qty:12}, // Promoción genérica, gasta tapas. El relleno depende.
            ] 
        },

        // === PIZZAS ===
        { 
            name: 'Pizza Muzzarella', 
            price: 9000, 
            cat: 'Pizzas',
            recipe: [
                { ing: 'Masa Pizza', qty: 1 },
                { ing: 'Queso Muzzarella', qty: 0.25 },
            ]
        },
        { 
            name: 'Pizza Napolitana', 
            price: 11000, 
            cat: 'Pizzas',
            recipe: [
                { ing: 'Masa Pizza', qty: 1 },
                { ing: 'Queso Muzzarella', qty: 0.25 },
                { ing: 'Tomate', qty: 0.2 },
            ]
        },
        { 
            name: 'Pizza Jamón y Morrones', 
            price: 12000, 
            cat: 'Pizzas',
            recipe: [
                { ing: 'Masa Pizza', qty: 1 },
                { ing: 'Queso Muzzarella', qty: 0.25 },
                { ing: 'Jamón Cocido', qty: 0.1 },
            ]
        },

        // === BEBIDAS ===
        { name: 'Coca Cola 1.5L', price: 4000, cat: 'Bebidas', recipe: [{ing: 'Coca Cola 1.5L', qty: 1}] },
        { name: 'Coca Cola 500ml', price: 2000, cat: 'Bebidas', recipe: [{ing: 'Coca Cola 500ml', qty: 1}] },
        { name: 'Cerveza Quilmes 1L', price: 3800, cat: 'Bebidas', recipe: [{ing: 'Cerveza Quilmes 1L', qty: 1}] },
        { name: 'Levite 1.5L', price: 3000, cat: 'Bebidas', recipe: [{ing: 'Levite 1.5L', qty: 1}] },
        { name: 'Soda Sifón', price: 2500, cat: 'Bebidas', recipe: [{ing: 'Soda Sifón', qty: 1}] },
        
        // === PROMOS ===
        { 
            name: 'Promo Milanesas (2 pers)', 
            price: 19000, 
            cat: 'Promos',
            recipe: [
                { ing: 'Carne para Milanesa (Nalga)', qty: 0.5 },
                { ing: 'Papa', qty: 0.8 },
                { ing: 'Coca Cola 1.5L', qty: 1 }
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
                    description: `Delicioso ${p.name}, fresco y casero.`,
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&size=256`
                }
            });

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
    console.log('✅ Productos y Recetas');

    // ============================================
    // 8. MODIFICADORES
    // ============================================
    const modifierGroupsData = [
        { 
            name: 'Cocción Milanesa', 
            min: 1, 
            max: 1, 
            options: [
                { name: 'Frita', price: 0 },
                { name: 'Al Horno', price: 0 },
            ] 
        },
        { 
            name: 'Agregados Pizza', 
            min: 0, 
            max: 5, 
            options: [
                { name: 'Fainá', price: 1500 },
                { name: 'Extra Queso', price: 2500 },
                { name: 'Aceitunas Extra', price: 1000 },
            ] 
        },
        {
            name: 'Gustos Empanadas (Docena)',
            min: 12,
            max: 12,
            options: [
                { name: 'Carne', price: 0 },
                { name: 'Pollo', price: 0 },
                { name: 'Jamón y Queso', price: 0 },
                { name: 'Verdura', price: 0 },
                { name: 'Roquefort', price: 0 },
                { name: 'Humita', price: 0 },
            ]
        }
    ];

    const modGroupsMap = new Map();

    for (const group of modifierGroupsData) {
        const existingGroup = await prisma.modifierGroup.findFirst({ 
            where: { name: group.name, tenantId },
            include: { options: true }
        });
         
        if (!existingGroup) {
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

    // Link Modifiers
    const milanesas = await prisma.product.findMany({ where: { tenantId, name: { contains: 'Milanesa' } } });
    const pizzas = await prisma.product.findMany({ 
        where: { 
            tenantId, 
            category: { name: 'Pizzas' } 
        } 
    });
    const docena = await prisma.product.findFirst({ where: { tenantId, name: 'Docena Empanadas' } });

    const coccionMila = modGroupsMap.get('Cocción Milanesa');
    const agregadosPizza = modGroupsMap.get('Agregados Pizza');
    const gustosEmpanadas = modGroupsMap.get('Gustos Empanadas (Docena)');

    if (coccionMila) {
        for (const p of milanesas) {
            await prisma.productModifierGroup.createMany({
                data: [{ tenantId, productId: p.id, modifierGroupId: coccionMila.id }], 
                skipDuplicates: true 
            });
        }
    }

    if (agregadosPizza) {
        for (const p of pizzas) {
            await prisma.productModifierGroup.createMany({
                data: [{ tenantId, productId: p.id, modifierGroupId: agregadosPizza.id }], 
                skipDuplicates: true 
            });
        }
    }

    if (docena && gustosEmpanadas) {
        await prisma.productModifierGroup.createMany({
            data: [{ tenantId, productId: docena.id, modifierGroupId: gustosEmpanadas.id }], 
            skipDuplicates: true 
        });
    }

    console.log('✅ Modificadores');

    // ============================================
    // 9. ÁREAS Y MESAS
    // ============================================
    const areaMostrador = await prisma.area.upsert({
        where: { tenantId_name: { tenantId, name: 'Mostrador' } },
        update: {},
        create: { tenantId, name: 'Mostrador' }
    });
    
    const areaDelivery = await prisma.area.upsert({
        where: { tenantId_name: { tenantId, name: 'Delivery' } },
        update: {},
        create: { tenantId, name: 'Delivery' }
    });

    // Mesas (Mostrador solo para espera)
    await prisma.table.createMany({
        data: [
            { tenantId, areaId: areaMostrador.id, name: 'Espera 1', x: 50, y: 50 },
            { tenantId, areaId: areaMostrador.id, name: 'Espera 2', x: 150, y: 50 },
        ],
        skipDuplicates: true
    });
    console.log('✅ Áreas y Mesas');

    // ============================================
    // 10. SEQ
    // ============================================
    const now = new Date(); // 2026-02-03
    const sequenceKey = `TENANT_${tenantId}_DATE_20260203`;
    
    await prisma.orderSequence.upsert({
        where: { tenantId_sequenceKey: { tenantId, sequenceKey } },
        update: {},
        create: {
            tenantId,
            sequenceKey,
            currentValue: 0
        }
    });
    console.log('✅ Order Sequence (20260203)');

    console.log('🚀 Seed Rotisería Finalizado con Éxito!');
    console.log('👉 Tenant Code: rotiseria_demo');
    console.log('👉 Usuario Admin: admin@rotiseria.com / 123456');
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
