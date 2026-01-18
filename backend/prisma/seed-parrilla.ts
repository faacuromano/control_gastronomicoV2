/**
 * Seed de Datos - Parrilla/Rotisería Argentina
 * Precios actualizados a Enero 2026 (ARS)
 * 
 * Para usar:
 * 1. Actualizar prisma/seed.ts con: import './seed-parrilla'
 * 2. O reemplazar el contenido de seed.ts con este archivo
 * 3. Ejecutar: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('🥩 Iniciando Seed: Parrilla Argentina...');
    console.log('📅 Precios actualizados a Enero 2026');

    // ============================================
    // 1. CONFIGURACIÓN DEL NEGOCIO
    // ============================================
    await prisma.tenantConfig.upsert({
        where: { id: 1 },
        update: {
            businessName: 'La Estancia - Parrilla & Rotisería',
            enableStock: true,
            enableDelivery: true,
            enableKDS: true,
        },
        create: {
            businessName: 'La Estancia - Parrilla & Rotisería',
            enableStock: true,
            enableDelivery: true,
            enableKDS: true,
            currencySymbol: '$'
        },
    });
    console.log('✅ Configuración del negocio');

    // ============================================
    // 2. ROLES (RBAC)
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
                orders: ['create', 'read']
            } 
        },
        { 
            name: 'MOZO', 
            permissions: { 
                pos: ['access', 'create', 'read', 'update'],
                tables: ['access', 'read', 'update'],
                orders: ['create', 'read', 'update']
            } 
        },
        { 
            name: 'PARRILLERO', 
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
            where: { name: r.name },
            update: { permissions: r.permissions },
            create: r,
        });
    }
    console.log('✅ Roles');

    // ============================================
    // 3. USUARIOS
    // ============================================
    const passwordHash = await bcrypt.hash('123456', 10);
    const users = [
        { name: 'Administrador', email: 'admin@laestancia.com', pin: process.env.SEED_ADMIN_PIN || '999999', role: 'ADMIN' },
        { name: 'María Cajera', email: 'cajera@laestancia.com', pin: '111111', role: 'CAJERO' },
        { name: 'Carlos Mozo', email: 'mozo@laestancia.com', pin: '222222', role: 'MOZO' },
        { name: 'Julio Parrillero', email: 'parrillero@laestancia.com', pin: '333333', role: 'PARRILLERO' },
        { name: 'Pedro Delivery', email: 'delivery@laestancia.com', pin: '444444', role: 'DELIVERY' },
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
                pinCode: u.pin,
                passwordHash,
                roleId: role.id,
                isActive: true,
            },
        });
    }
    console.log('✅ Usuarios');

    // ============================================
    // 4. CATEGORÍAS
    // ============================================
    const categoriesData = [
        { name: 'Parrilla' },
        { name: 'Rotisería' },
        { name: 'Achuras' },
        { name: 'Guarniciones' },
        { name: 'Empanadas' },
        { name: 'Bebidas' },
        { name: 'Postres' },
        { name: 'Promos' },
    ];

    const categoriesMap = new Map<string, number>();
    for (const c of categoriesData) {
        let existing = await prisma.category.findFirst({ where: { name: c.name } });
        if (!existing) {
            existing = await prisma.category.create({ data: { name: c.name } });
        }
        categoriesMap.set(c.name, existing.id);
    }
    console.log('✅ Categorías');

    // ============================================
    // 5. INGREDIENTES / INVENTARIO
    // Precios en ARS Enero 2026 (x1000 inflación considerada)
    // ============================================
    const ingredientsData = [
        // Carnes de parrilla
        { name: 'Asado de Tira', unit: 'kg', cost: 12000, stock: 50 },
        { name: 'Vacío', unit: 'kg', cost: 14000, stock: 30 },
        { name: 'Entraña', unit: 'kg', cost: 16000, stock: 20 },
        { name: 'Bife de Chorizo', unit: 'kg', cost: 15000, stock: 25 },
        { name: 'Bife Angosto', unit: 'kg', cost: 14500, stock: 25 },
        { name: 'Ojo de Bife', unit: 'kg', cost: 18000, stock: 15 },
        { name: 'Matambre', unit: 'kg', cost: 11000, stock: 20 },
        { name: 'Tapa de Asado', unit: 'kg', cost: 10000, stock: 20 },
        { name: 'Costilla de Cerdo', unit: 'kg', cost: 8000, stock: 20 },
        
        // Achuras
        { name: 'Chorizo Parrillero', unit: 'u', cost: 800, stock: 100 },
        { name: 'Morcilla', unit: 'u', cost: 700, stock: 80 },
        { name: 'Molleja', unit: 'kg', cost: 10000, stock: 15 },
        { name: 'Chinchulín', unit: 'kg', cost: 6000, stock: 10 },
        { name: 'Riñón', unit: 'u', cost: 1200, stock: 30 },
        { name: 'Provoleta', unit: 'u', cost: 1500, stock: 50 },
        
        // Rotisería
        { name: 'Pollo Entero', unit: 'u', cost: 5000, stock: 30 },
        { name: 'Pollo Media', unit: 'u', cost: 2500, stock: 40 },
        { name: 'Costillar BBQ', unit: 'kg', cost: 9000, stock: 20 },
        { name: 'Bondiola Ahumada', unit: 'kg', cost: 11000, stock: 15 },
        { name: 'Lechón (porción)', unit: 'kg', cost: 12000, stock: 20 },
        
        // Empanadas
        { name: 'Tapa Empanada Criolla', unit: 'u', cost: 150, stock: 200 },
        { name: 'Relleno Carne', unit: 'kg', cost: 8000, stock: 10 },
        { name: 'Relleno JyQ', unit: 'kg', cost: 7000, stock: 8 },
        { name: 'Relleno Pollo', unit: 'kg', cost: 6500, stock: 8 },
        { name: 'Relleno Verdura', unit: 'kg', cost: 4000, stock: 5 },
        { name: 'Relleno Humita', unit: 'kg', cost: 4500, stock: 5 },
        
        // Guarniciones
        { name: 'Papa', unit: 'kg', cost: 1500, stock: 50 },
        { name: 'Ensalada Mixta', unit: 'porción', cost: 500, stock: 100 },
        { name: 'Arroz', unit: 'kg', cost: 1200, stock: 20 },
        { name: 'Pan de Campo', unit: 'u', cost: 300, stock: 100 },
        { name: 'Puré', unit: 'porción', cost: 800, stock: 50 },
        { name: 'Verduras Grilladas', unit: 'porción', cost: 600, stock: 50 },
        
        // Bebidas
        { name: 'Coca Cola 500ml', unit: 'u', cost: 1200, stock: 100 },
        { name: 'Coca Cola 1.5L', unit: 'u', cost: 2500, stock: 50 },
        { name: 'Agua Mineral 500ml', unit: 'u', cost: 600, stock: 100 },
        { name: 'Cerveza Quilmes', unit: 'u', cost: 1500, stock: 200 },
        { name: 'Cerveza Patagonia', unit: 'u', cost: 2500, stock: 100 },
        { name: 'Vino Tinto (copa)', unit: 'u', cost: 1000, stock: 200 },
        { name: 'Vino Malbec Botella', unit: 'u', cost: 6000, stock: 30 },
        { name: 'Fernet Branca', unit: 'medida', cost: 1500, stock: 100 },
        { name: 'Gaseosa Línea', unit: 'u', cost: 1000, stock: 100 },
        
        // Postres
        { name: 'Flan Casero', unit: 'u', cost: 1000, stock: 30 },
        { name: 'Vigilante (porción)', unit: 'u', cost: 1500, stock: 20 },
        { name: 'Helado (bochita)', unit: 'u', cost: 800, stock: 50 },
    ];

    const ingredientsMap = new Map<string, number>();

    for (const ing of ingredientsData) {
        let dbIng = await prisma.ingredient.findFirst({ where: { name: ing.name } });
        
        if (!dbIng) {
            dbIng = await prisma.ingredient.create({
                data: {
                    name: ing.name,
                    unit: ing.unit,
                    cost: ing.cost,
                    stock: 0,
                }
            });
            
            await prisma.stockMovement.create({
                data: {
                    ingredientId: dbIng.id,
                    type: 'PURCHASE',
                    quantity: ing.stock,
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
    // 6. PRODUCTOS Y RECETAS
    // Precios PVP Enero 2026
    // ============================================
    const productsData = [
        // === PARRILLA ===
        { 
            name: 'Asado de Tira (500g)', 
            price: 18500, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Asado de Tira', qty: 0.5 }]
        },
        { 
            name: 'Vacío (400g)', 
            price: 19500, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Vacío', qty: 0.4 }]
        },
        { 
            name: 'Entraña (350g)', 
            price: 21000, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Entraña', qty: 0.35 }]
        },
        { 
            name: 'Bife de Chorizo', 
            price: 22000, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Bife de Chorizo', qty: 0.4 }]
        },
        { 
            name: 'Bife Angosto', 
            price: 20000, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Bife Angosto', qty: 0.35 }]
        },
        { 
            name: 'Ojo de Bife', 
            price: 26000, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Ojo de Bife', qty: 0.35 }]
        },
        { 
            name: 'Matambre a la Pizza', 
            price: 18000, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Matambre', qty: 0.4 }]
        },
        { 
            name: 'Costilla de Cerdo BBQ', 
            price: 16000, 
            cat: 'Parrilla',
            recipe: [{ ing: 'Costilla de Cerdo', qty: 0.5 }]
        },
        { 
            name: 'Parrillada para 2', 
            price: 42000, 
            cat: 'Parrilla',
            recipe: [
                { ing: 'Asado de Tira', qty: 0.4 },
                { ing: 'Vacío', qty: 0.25 },
                { ing: 'Chorizo Parrillero', qty: 2 },
                { ing: 'Morcilla', qty: 1 },
            ]
        },
        { 
            name: 'Parrillada Completa (4 pers)', 
            price: 78000, 
            cat: 'Parrilla',
            recipe: [
                { ing: 'Asado de Tira', qty: 0.8 },
                { ing: 'Vacío', qty: 0.5 },
                { ing: 'Entraña', qty: 0.3 },
                { ing: 'Chorizo Parrillero', qty: 4 },
                { ing: 'Morcilla', qty: 2 },
                { ing: 'Molleja', qty: 0.2 },
            ]
        },

        // === ACHURAS ===
        { 
            name: 'Chorizo Parrillero', 
            price: 4500, 
            cat: 'Achuras',
            recipe: [{ ing: 'Chorizo Parrillero', qty: 1 }]
        },
        { 
            name: 'Morcilla', 
            price: 4000, 
            cat: 'Achuras',
            recipe: [{ ing: 'Morcilla', qty: 1 }]
        },
        { 
            name: 'Choripán', 
            price: 5500, 
            cat: 'Achuras',
            recipe: [
                { ing: 'Chorizo Parrillero', qty: 1 },
                { ing: 'Pan de Campo', qty: 1 },
            ]
        },
        { 
            name: 'Molleja', 
            price: 12000, 
            cat: 'Achuras',
            recipe: [{ ing: 'Molleja', qty: 0.25 }]
        },
        { 
            name: 'Chinchulín', 
            price: 8000, 
            cat: 'Achuras',
            recipe: [{ ing: 'Chinchulín', qty: 0.25 }]
        },
        { 
            name: 'Riñón', 
            price: 6000, 
            cat: 'Achuras',
            recipe: [{ ing: 'Riñón', qty: 1 }]
        },
        { 
            name: 'Provoleta', 
            price: 7500, 
            cat: 'Achuras',
            recipe: [{ ing: 'Provoleta', qty: 1 }]
        },

        // === ROTISERÍA ===
        { 
            name: 'Pollo al Spiedo Entero', 
            price: 12000, 
            cat: 'Rotisería',
            recipe: [{ ing: 'Pollo Entero', qty: 1 }]
        },
        { 
            name: 'Medio Pollo al Spiedo', 
            price: 6500, 
            cat: 'Rotisería',
            recipe: [{ ing: 'Pollo Media', qty: 1 }]
        },
        { 
            name: 'Bondiola Ahumada (400g)', 
            price: 15000, 
            cat: 'Rotisería',
            recipe: [{ ing: 'Bondiola Ahumada', qty: 0.4 }]
        },
        { 
            name: 'Lechón (porción)', 
            price: 18000, 
            cat: 'Rotisería',
            recipe: [{ ing: 'Lechón (porción)', qty: 0.5 }]
        },

        // === EMPANADAS ===
        { 
            name: 'Empanada de Carne', 
            price: 2800, 
            cat: 'Empanadas',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 1 },
                { ing: 'Relleno Carne', qty: 0.08 },
            ]
        },
        { 
            name: 'Empanada de JyQ', 
            price: 2600, 
            cat: 'Empanadas',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 1 },
                { ing: 'Relleno JyQ', qty: 0.08 },
            ]
        },
        { 
            name: 'Empanada de Pollo', 
            price: 2600, 
            cat: 'Empanadas',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 1 },
                { ing: 'Relleno Pollo', qty: 0.08 },
            ]
        },
        { 
            name: 'Empanada de Verdura', 
            price: 2400, 
            cat: 'Empanadas',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 1 },
                { ing: 'Relleno Verdura', qty: 0.08 },
            ]
        },
        { 
            name: 'Empanada de Humita', 
            price: 2400, 
            cat: 'Empanadas',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 1 },
                { ing: 'Relleno Humita', qty: 0.08 },
            ]
        },
        { 
            name: 'Docena de Empanadas Surtidas', 
            price: 28000, 
            cat: 'Empanadas',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 12 },
                { ing: 'Relleno Carne', qty: 0.5 },
                { ing: 'Relleno JyQ', qty: 0.3 },
                { ing: 'Relleno Pollo', qty: 0.16 },
            ]
        },

        // === GUARNICIONES ===
        { 
            name: 'Papas Fritas', 
            price: 6500, 
            cat: 'Guarniciones',
            recipe: [{ ing: 'Papa', qty: 0.4 }]
        },
        { 
            name: 'Ensalada Mixta', 
            price: 5500, 
            cat: 'Guarniciones',
            recipe: [{ ing: 'Ensalada Mixta', qty: 1 }]
        },
        { 
            name: 'Puré', 
            price: 5000, 
            cat: 'Guarniciones',
            recipe: [{ ing: 'Puré', qty: 1 }]
        },
        { 
            name: 'Verduras Grilladas', 
            price: 6000, 
            cat: 'Guarniciones',
            recipe: [{ ing: 'Verduras Grilladas', qty: 1 }]
        },
        { 
            name: 'Pan de Campo', 
            price: 1500, 
            cat: 'Guarniciones',
            recipe: [{ ing: 'Pan de Campo', qty: 1 }]
        },

        // === BEBIDAS ===
        { 
            name: 'Coca Cola 500ml', 
            price: 3500, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Coca Cola 500ml', qty: 1 }]
        },
        { 
            name: 'Coca Cola 1.5L', 
            price: 5500, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Coca Cola 1.5L', qty: 1 }]
        },
        { 
            name: 'Agua Mineral 500ml', 
            price: 2000, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Agua Mineral 500ml', qty: 1 }]
        },
        { 
            name: 'Gaseosa Línea', 
            price: 3000, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Gaseosa Línea', qty: 1 }]
        },
        { 
            name: 'Cerveza Quilmes 1L', 
            price: 4500, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Cerveza Quilmes', qty: 1 }]
        },
        { 
            name: 'Cerveza Patagonia', 
            price: 6000, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Cerveza Patagonia', qty: 1 }]
        },
        { 
            name: 'Copa de Vino Tinto', 
            price: 4500, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Vino Tinto (copa)', qty: 1 }]
        },
        { 
            name: 'Vino Malbec Botella', 
            price: 15000, 
            cat: 'Bebidas',
            recipe: [{ ing: 'Vino Malbec Botella', qty: 1 }]
        },
        { 
            name: 'Fernet con Coca', 
            price: 6000, 
            cat: 'Bebidas',
            recipe: [
                { ing: 'Fernet Branca', qty: 1 },
                { ing: 'Coca Cola 500ml', qty: 0.5 }
            ]
        },

        // === POSTRES ===
        { 
            name: 'Flan con Dulce de Leche', 
            price: 5500, 
            cat: 'Postres',
            recipe: [{ ing: 'Flan Casero', qty: 1 }]
        },
        { 
            name: 'Vigilante', 
            price: 6500, 
            cat: 'Postres',
            recipe: [{ ing: 'Vigilante (porción)', qty: 1 }]
        },
        { 
            name: 'Helado 3 Bochas', 
            price: 6000, 
            cat: 'Postres',
            recipe: [{ ing: 'Helado (bochita)', qty: 3 }]
        },

        // === PROMOS ===
        { 
            name: 'Promo Pollo + Papas', 
            price: 16000, 
            cat: 'Promos',
            recipe: [
                { ing: 'Pollo Entero', qty: 1 },
                { ing: 'Papa', qty: 0.5 },
            ]
        },
        { 
            name: 'Promo Parrilla Express (2 pers)', 
            price: 35000, 
            cat: 'Promos',
            recipe: [
                { ing: 'Asado de Tira', qty: 0.4 },
                { ing: 'Vacío', qty: 0.3 },
                { ing: 'Chorizo Parrillero', qty: 2 },
                { ing: 'Ensalada Mixta', qty: 2 },
            ]
        },
        { 
            name: 'Promo 12 Empanadas + Bebida', 
            price: 32000, 
            cat: 'Promos',
            recipe: [
                { ing: 'Tapa Empanada Criolla', qty: 12 },
                { ing: 'Relleno Carne', qty: 0.6 },
                { ing: 'Coca Cola 1.5L', qty: 1 },
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
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&size=256`
                }
            });

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
    console.log('✅ Productos y Recetas');

    // ============================================
    // 7. MODIFICADORES
    // ============================================
    const modifierGroupsData = [
        { 
            name: 'Punto de Cocción', 
            min: 1, 
            max: 1, 
            options: [
                { name: 'Jugoso', price: 0 },
                { name: 'A Punto', price: 0 },
                { name: 'Bien Cocido', price: 0 }
            ] 
        },
        { 
            name: 'Extras Parrilla', 
            min: 0, 
            max: 5, 
            options: [
                { name: 'Huevo Frito', price: 2000 },
                { name: 'Provoleta Extra', price: 5000 },
                { name: 'Chimichurri', price: 0 },
                { name: 'Salsa Criolla', price: 0 },
                { name: 'Sin Sal', price: 0 },
            ] 
        },
        {
            name: 'Tipo Empanada',
            min: 1,
            max: 1,
            options: [
                { name: 'Frita', price: 500 },
                { name: 'Al Horno', price: 0 }
            ]
        },
        {
            name: 'Temperatura Bebida',
            min: 1,
            max: 1,
            options: [
                { name: 'Fría', price: 0 },
                { name: 'Natural', price: 0 },
                { name: 'Con Hielo', price: 0 }
            ]
        }
    ];

    const modGroupsMap = new Map();

    for (const group of modifierGroupsData) {
        const existingGroup = await prisma.modifierGroup.findFirst({ 
            where: { name: group.name },
            include: { options: true }
        });
         
        if (!existingGroup) {
            const newGroup = await prisma.modifierGroup.create({
                data: {
                    name: group.name,
                    minSelection: group.min,
                    maxSelection: group.max,
                    options: {
                        create: group.options.map(o => ({
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

    // Vincular modificadores a productos de parrilla
    const parrillaProducts = await prisma.product.findMany({
        where: { 
            category: { name: 'Parrilla' }
        }
    });

    const coccionGroup = modGroupsMap.get('Punto de Cocción');
    const extrasGroup = modGroupsMap.get('Extras Parrilla');

    for (const prod of parrillaProducts) {
        if (coccionGroup) {
            await prisma.productModifierGroup.createMany({
                data: [
                    { productId: prod.id, modifierGroupId: coccionGroup.id },
                    { productId: prod.id, modifierGroupId: extrasGroup.id }
                ],
                skipDuplicates: true
            });
        }
    }

    // Vincular tipo empanada
    const empanadaProducts = await prisma.product.findMany({
        where: { category: { name: 'Empanadas' } }
    });
    const tipoEmpanada = modGroupsMap.get('Tipo Empanada');
    
    if (tipoEmpanada) {
        for (const emp of empanadaProducts) {
            await prisma.productModifierGroup.createMany({
                data: [{ productId: emp.id, modifierGroupId: tipoEmpanada.id }],
                skipDuplicates: true
            });
        }
    }

    console.log('✅ Modificadores');

    // ============================================
    // 8. ÁREAS Y MESAS
    // ============================================
    const salonPrincipal = await prisma.area.upsert({
        where: { id: 1 },
        update: { name: 'Salón Principal' },
        create: { name: 'Salón Principal' }
    });

    const vereda = await prisma.area.upsert({
        where: { id: 2 },
        update: { name: 'Vereda' },
        create: { name: 'Vereda' }
    });

    const quincho = await prisma.area.upsert({
        where: { id: 3 },
        update: { name: 'Quincho' },
        create: { name: 'Quincho' }
    });

    const tablesData = [
        // Salón Principal
        { name: 'Mesa 1', areaId: salonPrincipal.id, x: 50, y: 50 },
        { name: 'Mesa 2', areaId: salonPrincipal.id, x: 200, y: 50 },
        { name: 'Mesa 3', areaId: salonPrincipal.id, x: 350, y: 50 },
        { name: 'Mesa 4', areaId: salonPrincipal.id, x: 50, y: 200 },
        { name: 'Mesa 5', areaId: salonPrincipal.id, x: 200, y: 200 },
        { name: 'Mesa 6', areaId: salonPrincipal.id, x: 350, y: 200 },
        { name: 'Barra', areaId: salonPrincipal.id, x: 500, y: 100 },
        // Vereda
        { name: 'Vereda 1', areaId: vereda.id, x: 50, y: 50 },
        { name: 'Vereda 2', areaId: vereda.id, x: 200, y: 50 },
        { name: 'Vereda 3', areaId: vereda.id, x: 350, y: 50 },
        // Quincho
        { name: 'Quincho 1', areaId: quincho.id, x: 50, y: 50 },
        { name: 'Quincho 2', areaId: quincho.id, x: 200, y: 50 },
    ];

    for (const t of tablesData) {
        const existing = await prisma.table.findFirst({ where: { name: t.name, areaId: t.areaId } });
        if (!existing) {
            await prisma.table.create({ data: t });
        }
    }
    console.log('✅ Áreas y Mesas');

    // ============================================
    // 9. MÉTODOS DE PAGO
    // ============================================
    const paymentMethods = [
        { code: 'CASH', name: 'Efectivo', icon: 'Banknote', sortOrder: 1, isActive: true },
        { code: 'DEBIT', name: 'Débito', icon: 'CreditCard', sortOrder: 2, isActive: true },
        { code: 'CREDIT', name: 'Crédito', icon: 'CreditCard', sortOrder: 3, isActive: true },
        { code: 'MP', name: 'Mercado Pago', icon: 'Smartphone', sortOrder: 4, isActive: true },
        { code: 'TRANSFER', name: 'Transferencia', icon: 'ArrowLeftRight', sortOrder: 5, isActive: true },
    ];

    for (const pm of paymentMethods) {
        await prisma.paymentMethodConfig.upsert({
            where: { code: pm.code },
            update: pm,
            create: pm
        });
    }
    console.log('✅ Métodos de Pago');

    // ============================================
    // 10. TURNO DE CAJA ABIERTO
    // ============================================
    const cajeraUser = await prisma.user.findFirst({ where: { email: 'cajera@laestancia.com' } });
    if (cajeraUser) {
        const existingShift = await prisma.cashShift.findFirst({
            where: { userId: cajeraUser.id, endTime: null }
        });

        if (!existingShift) {
            await prisma.cashShift.create({
                data: {
                    userId: cajeraUser.id,
                    startAmount: 50000,
                    businessDate: new Date(),
                    startTime: new Date(),
                }
            });
            console.log('✅ Turno de Caja Abierto');
        }
    }

    // ============================================
    // 11. CLIENTE DE PRUEBA
    // ============================================
    const testClient = await prisma.client.findFirst({ where: { phone: '1155551234' } });
    if (!testClient) {
        await prisma.client.create({
            data: {
                name: 'Juan Pérez',
                phone: '1155551234',
                address: 'Av. Corrientes 1234, CABA',
                email: 'juanperez@email.com'
            }
        });
    }
    console.log('✅ Cliente de Prueba');

    console.log('');
    console.log('🎉 Seed Parrilla Argentina completado!');
    console.log('📊 Resumen:');
    console.log(`   - ${roles.length} roles`);
    console.log(`   - ${users.length} usuarios`);
    console.log(`   - ${categoriesData.length} categorías`);
    console.log(`   - ${ingredientsData.length} ingredientes`);
    console.log(`   - ${productsData.length} productos`);
    console.log(`   - ${tablesData.length} mesas en 3 áreas`);
    console.log('');
    console.log('🔑 Usuarios de prueba:');
    console.log('   Admin: admin@laestancia.com / PIN: 999999');
    console.log('   Cajera: cajera@laestancia.com / PIN: 111111');
    console.log('   Mozo: mozo@laestancia.com / PIN: 222222');
    console.log('   Parrillero: parrillero@laestancia.com / PIN: 333333');
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
