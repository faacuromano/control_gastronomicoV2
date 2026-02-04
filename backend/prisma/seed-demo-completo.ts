/**
 * SEED DEMO COMPLETO
 * Crea 3 negocios gastronómicos con datos realistas:
 * 1. Rotisería "La Gorda" - venta por peso
 * 2. Pollería "El Pollón" - pollos y acompañamientos
 * 3. Restaurant "Gourmet 42" - carta fina
 *
 * Ejecutar: npx tsx prisma/seed-demo-completo.ts
 */

import { PrismaClient, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// Helper para generar pinLookup (debe coincidir con auth.service.ts)
// Usa HMAC-SHA256 con el mismo secreto que el servicio de auth
const PIN_HMAC_SECRET = process.env.PIN_HMAC_SECRET || process.env.JWT_SECRET || 'default-secret';
const generatePinLookup = (pin: string): string => {
    return crypto.createHmac('sha256', PIN_HMAC_SECRET).update(pin).digest('hex');
};

// ============================================
// LIMPIAR BASE DE DATOS COMPLETAMENTE
// ============================================
async function clearDatabase() {
    console.log('🗑️  Limpiando base de datos...');

    // Orden correcto para respetar foreign keys
    await prisma.orderItemModifier.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cashShift.deleteMany();
    await prisma.refreshToken.deleteMany();

    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();

    await prisma.stockMovement.deleteMany();
    await prisma.productIngredient.deleteMany();
    await prisma.productModifierGroup.deleteMany();
    await prisma.modifierOption.deleteMany();
    await prisma.modifierGroup.deleteMany();
    await prisma.productChannelPrice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.ingredient.deleteMany();
    await prisma.supplier.deleteMany();

    await prisma.qrCode.deleteMany();
    await prisma.table.deleteMany();
    await prisma.areaPrinterOverride.deleteMany();
    await prisma.area.deleteMany();
    await prisma.category.deleteMany();
    await prisma.printer.deleteMany();

    await prisma.deliveryDriver.deleteMany();
    await prisma.tenantPlatformConfig.deleteMany();
    await prisma.deliveryPlatform.deleteMany();

    await prisma.paymentMethodConfig.deleteMany();
    await prisma.taxRate.deleteMany();
    await prisma.client.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.orderSequence.deleteMany();

    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.tenantConfig.deleteMany();
    await prisma.tenant.deleteMany();

    console.log('✅ Base de datos limpia');
}

// ============================================
// ROLES ESTÁNDAR
// ============================================
const standardRoles = [
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
            delivery: ['access', 'read']
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

// ============================================
// 1. ROTISERÍA "LA GORDA"
// ============================================
async function createRotiseria() {
    console.log('\n🍗 Creando Rotisería "La Gorda"...');

    const tenant = await prisma.tenant.create({
        data: { name: 'Rotisería La Gorda', code: 'rotiseria_la_gorda', activeSubscription: true }
    });
    const tenantId = tenant.id;

    // Config
    await prisma.tenantConfig.create({
        data: {
            tenantId,
            businessName: 'Rotisería La Gorda',
            enableStock: true,
            enableDelivery: true,
            enableKDS: true,
            currencySymbol: '$',
            defaultTaxRate: 0
        }
    });

    // Roles
    const rolesMap = new Map<string, number>();
    for (const r of standardRoles) {
        const role = await prisma.role.create({ data: { ...r, tenantId } });
        rolesMap.set(r.name, role.id);
    }

    // Usuarios
    const users = [
        { name: 'María Dueña', email: 'admin@lagorda.com', pin: '999999', role: 'ADMIN' },
        { name: 'Susana Cajera', email: 'caja@lagorda.com', pin: '111111', role: 'CAJERO' },
        { name: 'Ramón Cocina', email: 'cocina@lagorda.com', pin: '222222', role: 'COCINERO' },
        { name: 'Carlos Moto', email: 'delivery@lagorda.com', pin: '333333', role: 'REPARTIDOR' },
    ];
    for (const u of users) {
        const roleId = rolesMap.get(u.role)!;
        const pinHash = await bcrypt.hash(u.pin, 10);
        const pinLookup = generatePinLookup(u.pin);
        await prisma.user.create({
            data: { tenantId, name: u.name, email: u.email, pinHash, pinLookup, roleId, isActive: true }
        });
    }

    // Proveedores
    const suppliersData = [
        { name: 'Pollos Don Juan', phone: '11-5555-0001', email: 'ventas@donjuan.com', taxId: '30-12345678-9' },
        { name: 'Verdulería Central', phone: '11-5555-0002', email: 'pedidos@verduleria.com', taxId: '30-23456789-0' },
        { name: 'Distribuidora Fiambres SA', phone: '11-5555-0003', email: 'ventas@fiambres.com', taxId: '30-34567890-1' },
    ];
    for (const s of suppliersData) {
        await prisma.supplier.create({ data: { ...s, tenantId } });
    }

    // Métodos de pago
    const paymentMethods = [
        { code: 'CASH', name: 'Efectivo', icon: 'Banknote', sortOrder: 1 },
        { code: 'CARD', name: 'Tarjeta', icon: 'CreditCard', sortOrder: 2 },
        { code: 'TRANSFER', name: 'Transferencia', icon: 'Building', sortOrder: 3 },
        { code: 'QR_INTEGRATED', name: 'Mercado Pago QR', icon: 'QrCode', sortOrder: 4 },
    ];
    for (const pm of paymentMethods) {
        await prisma.paymentMethodConfig.create({ data: { ...pm, tenantId, isActive: true } });
    }

    // Impresoras
    const cocina = await prisma.printer.create({
        data: { tenantId, name: 'Impresora Cocina', connectionType: 'NETWORK', ipAddress: '192.168.1.100' }
    });
    const caja = await prisma.printer.create({
        data: { tenantId, name: 'Impresora Caja', connectionType: 'NETWORK', ipAddress: '192.168.1.101' }
    });

    // Categorías
    const categoriesData = [
        { name: 'Rotisería', printerId: cocina.id },
        { name: 'Por Peso', printerId: cocina.id },
        { name: 'Empanadas', printerId: cocina.id },
        { name: 'Tartas', printerId: cocina.id },
        { name: 'Bebidas', printerId: caja.id },
    ];
    const categoriesMap = new Map<string, number>();
    for (const c of categoriesData) {
        const cat = await prisma.category.create({ data: { ...c, tenantId } });
        categoriesMap.set(c.name, cat.id);
    }

    // Ingredientes
    const ingredientsData = [
        { name: 'Pollo Entero', unit: 'u', cost: 4500, stock: 50, minStock: 10 },
        { name: 'Papa', unit: 'kg', cost: 800, stock: 100, minStock: 20 },
        { name: 'Cebolla', unit: 'kg', cost: 600, stock: 50, minStock: 10 },
        { name: 'Morron', unit: 'kg', cost: 2500, stock: 30, minStock: 5 },
        { name: 'Huevo', unit: 'u', cost: 150, stock: 200, minStock: 50 },
        { name: 'Aceite Girasol', unit: 'lt', cost: 1200, stock: 40, minStock: 10 },
        { name: 'Carne Picada', unit: 'kg', cost: 6500, stock: 30, minStock: 5 },
        { name: 'Jamón Cocido', unit: 'kg', cost: 8500, stock: 10, minStock: 2 },
        { name: 'Queso Cremoso', unit: 'kg', cost: 7000, stock: 15, minStock: 3 },
        { name: 'Masa Empanada', unit: 'u', cost: 50, stock: 500, minStock: 100 },
        { name: 'Masa Tarta', unit: 'u', cost: 300, stock: 50, minStock: 10 },
        { name: 'Verdeo', unit: 'atado', cost: 400, stock: 20, minStock: 5 },
        { name: 'Espinaca', unit: 'kg', cost: 1800, stock: 10, minStock: 2 },
    ];
    const ingredientsMap = new Map<string, number>();
    for (const i of ingredientsData) {
        const ing = await prisma.ingredient.create({ data: { ...i, tenantId } });
        ingredientsMap.set(i.name, ing.id);
    }

    // Productos
    const productsData = [
        // Rotisería
        { name: 'Pollo al Spiedo Entero', price: 8500, categoryId: categoriesMap.get('Rotisería')! },
        { name: 'Medio Pollo', price: 4500, categoryId: categoriesMap.get('Rotisería')! },
        { name: 'Pata Muslo', price: 2500, categoryId: categoriesMap.get('Rotisería')! },
        { name: 'Suprema al Spiedo', price: 3200, categoryId: categoriesMap.get('Rotisería')! },

        // Por Peso (precios por kg o 100g según corresponda)
        { name: 'Papas Españolas (100g)', price: 450, categoryId: categoriesMap.get('Por Peso')! },
        { name: 'Tortilla de Papa (porción)', price: 1800, categoryId: categoriesMap.get('Por Peso')! },
        { name: 'Ensalada Rusa (100g)', price: 500, categoryId: categoriesMap.get('Por Peso')! },
        { name: 'Vitel Toné (100g)', price: 900, categoryId: categoriesMap.get('Por Peso')! },
        { name: 'Matambre Casero (100g)', price: 1200, categoryId: categoriesMap.get('Por Peso')! },
        { name: 'Croquetas de Papa (u)', price: 350, categoryId: categoriesMap.get('Por Peso')! },

        // Empanadas
        { name: 'Empanada Carne', price: 850, categoryId: categoriesMap.get('Empanadas')! },
        { name: 'Empanada Jamón y Queso', price: 850, categoryId: categoriesMap.get('Empanadas')! },
        { name: 'Empanada Pollo', price: 850, categoryId: categoriesMap.get('Empanadas')! },
        { name: 'Empanada Verdura', price: 800, categoryId: categoriesMap.get('Empanadas')! },
        { name: 'Empanada Humita', price: 800, categoryId: categoriesMap.get('Empanadas')! },
        { name: 'Docena Empanadas Surtidas', price: 9000, categoryId: categoriesMap.get('Empanadas')! },

        // Tartas
        { name: 'Tarta Jamón y Queso', price: 4500, categoryId: categoriesMap.get('Tartas')! },
        { name: 'Tarta Verdura', price: 4200, categoryId: categoriesMap.get('Tartas')! },
        { name: 'Tarta Pollo', price: 4800, categoryId: categoriesMap.get('Tartas')! },
        { name: 'Porción Tarta', price: 1500, categoryId: categoriesMap.get('Tartas')! },

        // Bebidas
        { name: 'Agua 500ml', price: 800, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },
        { name: 'Gaseosa 500ml', price: 1200, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },
        { name: 'Gaseosa 1.5L', price: 2200, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },
    ];
    for (const p of productsData) {
        await prisma.product.create({
            data: {
                ...p,
                tenantId,
                isStockable: p.isStockable ?? true,
                isActive: true
            }
        });
    }

    // Áreas y Mesas (mostrador + delivery)
    const mostrador = await prisma.area.create({ data: { tenantId, name: 'Mostrador' } });
    await prisma.table.create({ data: { tenantId, areaId: mostrador.id, name: 'Mostrador 1' } });
    await prisma.table.create({ data: { tenantId, areaId: mostrador.id, name: 'Mostrador 2' } });

    // Driver de delivery
    await prisma.deliveryDriver.create({
        data: { tenantId, name: 'Carlos Delivery', phone: '11-6666-0001', vehicleType: 'MOTORCYCLE', isActive: true, isAvailable: true }
    });

    console.log(`✅ Rotisería "La Gorda" creada (Tenant ID: ${tenantId})`);
    return tenantId;
}

// ============================================
// 2. POLLERÍA "EL POLLÓN"
// ============================================
async function createPolleria() {
    console.log('\n🐔 Creando Pollería "El Pollón"...');

    const tenant = await prisma.tenant.create({
        data: { name: 'Pollería El Pollón', code: 'polleria_el_pollon', activeSubscription: true }
    });
    const tenantId = tenant.id;

    // Config
    await prisma.tenantConfig.create({
        data: {
            tenantId,
            businessName: 'Pollería El Pollón',
            enableStock: true,
            enableDelivery: true,
            enableKDS: true,
            currencySymbol: '$',
            defaultTaxRate: 21
        }
    });

    // Roles
    const rolesMap = new Map<string, number>();
    for (const r of standardRoles) {
        const role = await prisma.role.create({ data: { ...r, tenantId } });
        rolesMap.set(r.name, role.id);
    }

    // Usuarios
    const users = [
        { name: 'Jorge Patrón', email: 'admin@elpollon.com', pin: '999999', role: 'ADMIN' },
        { name: 'Laura Caja', email: 'caja@elpollon.com', pin: '111111', role: 'CAJERO' },
        { name: 'Pedro Parrilla', email: 'cocina@elpollon.com', pin: '222222', role: 'COCINERO' },
        { name: 'Martín Moto', email: 'moto@elpollon.com', pin: '333333', role: 'REPARTIDOR' },
        { name: 'Ana Turno Tarde', email: 'tarde@elpollon.com', pin: '444444', role: 'CAJERO' },
    ];
    for (const u of users) {
        const roleId = rolesMap.get(u.role)!;
        const pinHash = await bcrypt.hash(u.pin, 10);
        const pinLookup = generatePinLookup(u.pin);
        await prisma.user.create({
            data: { tenantId, name: u.name, email: u.email, pinHash, pinLookup, roleId, isActive: true }
        });
    }

    // Proveedores
    const suppliersData = [
        { name: 'Granja Avícola Sur', phone: '11-4444-0001', email: 'ventas@granjasur.com', taxId: '30-11111111-1' },
        { name: 'Papas del Norte', phone: '11-4444-0002', email: 'pedidos@papasnorte.com', taxId: '30-22222222-2' },
        { name: 'Salsas y Aderezos SRL', phone: '11-4444-0003', email: 'info@salsas.com', taxId: '30-33333333-3' },
        { name: 'Distribuidora Bebidas Plus', phone: '11-4444-0004', email: 'ventas@bebidasplus.com', taxId: '30-44444444-4' },
    ];
    for (const s of suppliersData) {
        await prisma.supplier.create({ data: { ...s, tenantId } });
    }

    // Métodos de pago
    const paymentMethods = [
        { code: 'CASH', name: 'Efectivo', icon: 'Banknote', sortOrder: 1 },
        { code: 'CARD', name: 'Débito/Crédito', icon: 'CreditCard', sortOrder: 2 },
        { code: 'TRANSFER', name: 'Transferencia CBU', icon: 'Building', sortOrder: 3 },
        { code: 'QR_INTEGRATED', name: 'Pago QR', icon: 'QrCode', sortOrder: 4 },
    ];
    for (const pm of paymentMethods) {
        await prisma.paymentMethodConfig.create({ data: { ...pm, tenantId, isActive: true } });
    }

    // Impresoras
    const cocina = await prisma.printer.create({
        data: { tenantId, name: 'Cocina Principal', connectionType: 'NETWORK', ipAddress: '192.168.0.50' }
    });
    const caja = await prisma.printer.create({
        data: { tenantId, name: 'Caja Tickets', connectionType: 'NETWORK', ipAddress: '192.168.0.51' }
    });

    // Categorías
    const categoriesData = [
        { name: 'Pollos', printerId: cocina.id },
        { name: 'Combos', printerId: cocina.id },
        { name: 'Acompañamientos', printerId: cocina.id },
        { name: 'Salsas', printerId: caja.id },
        { name: 'Bebidas', printerId: caja.id },
        { name: 'Postres', printerId: caja.id },
    ];
    const categoriesMap = new Map<string, number>();
    for (const c of categoriesData) {
        const cat = await prisma.category.create({ data: { ...c, tenantId } });
        categoriesMap.set(c.name, cat.id);
    }

    // Ingredientes
    const ingredientsData = [
        { name: 'Pollo Entero (2kg)', unit: 'u', cost: 5000, stock: 80, minStock: 20 },
        { name: 'Papa para Fritas', unit: 'kg', cost: 900, stock: 150, minStock: 30 },
        { name: 'Aceite para Freidora', unit: 'lt', cost: 1100, stock: 60, minStock: 15 },
        { name: 'Sal Gruesa', unit: 'kg', cost: 200, stock: 30, minStock: 5 },
        { name: 'Chimichurri', unit: 'lt', cost: 2500, stock: 10, minStock: 2 },
        { name: 'Salsa Criolla', unit: 'lt', cost: 2000, stock: 10, minStock: 2 },
        { name: 'Mayonesa Balde', unit: 'kg', cost: 3500, stock: 8, minStock: 2 },
        { name: 'Ensalada Mixta', unit: 'kg', cost: 1500, stock: 20, minStock: 5 },
        { name: 'Pan de Mesa', unit: 'u', cost: 100, stock: 100, minStock: 20 },
    ];
    const ingredientsMap = new Map<string, number>();
    for (const i of ingredientsData) {
        const ing = await prisma.ingredient.create({ data: { ...i, tenantId } });
        ingredientsMap.set(i.name, ing.id);
    }

    // Productos
    const productsData = [
        // Pollos
        { name: 'Pollo Entero', price: 9500, categoryId: categoriesMap.get('Pollos')! },
        { name: 'Medio Pollo', price: 5000, categoryId: categoriesMap.get('Pollos')! },
        { name: 'Cuarto de Pollo', price: 2800, categoryId: categoriesMap.get('Pollos')! },
        { name: 'Pollo Deshuesado', price: 11000, categoryId: categoriesMap.get('Pollos')! },
        { name: 'Suprema Grande', price: 3500, categoryId: categoriesMap.get('Pollos')! },
        { name: 'Pata Muslo', price: 2800, categoryId: categoriesMap.get('Pollos')! },
        { name: 'Alitas x6', price: 3200, categoryId: categoriesMap.get('Pollos')! },

        // Combos
        { name: 'Combo 1 - Pollo + Papas Med + Bebida', price: 12500, categoryId: categoriesMap.get('Combos')! },
        { name: 'Combo 2 - Medio Pollo + Papas Chicas', price: 7500, categoryId: categoriesMap.get('Combos')! },
        { name: 'Combo Familiar - Pollo + Papas XL + 2 Bebidas', price: 16000, categoryId: categoriesMap.get('Combos')! },
        { name: 'Promo Amigos - 2 Pollos + Papas XL', price: 20000, categoryId: categoriesMap.get('Combos')! },

        // Acompañamientos
        { name: 'Papas Fritas Chicas', price: 2000, categoryId: categoriesMap.get('Acompañamientos')! },
        { name: 'Papas Fritas Medianas', price: 2800, categoryId: categoriesMap.get('Acompañamientos')! },
        { name: 'Papas Fritas Grandes', price: 3500, categoryId: categoriesMap.get('Acompañamientos')! },
        { name: 'Papas Fritas XL', price: 4500, categoryId: categoriesMap.get('Acompañamientos')! },
        { name: 'Ensalada Mixta', price: 2500, categoryId: categoriesMap.get('Acompañamientos')! },
        { name: 'Puré', price: 1800, categoryId: categoriesMap.get('Acompañamientos')! },
        { name: 'Pan (u)', price: 200, categoryId: categoriesMap.get('Acompañamientos')! },

        // Salsas
        { name: 'Salsa Chimichurri', price: 500, categoryId: categoriesMap.get('Salsas')!, isStockable: false },
        { name: 'Salsa Criolla', price: 500, categoryId: categoriesMap.get('Salsas')!, isStockable: false },
        { name: 'Mayonesa Extra', price: 400, categoryId: categoriesMap.get('Salsas')!, isStockable: false },
        { name: 'Salsa Barbacoa', price: 500, categoryId: categoriesMap.get('Salsas')!, isStockable: false },

        // Bebidas
        { name: 'Agua 500ml', price: 900, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },
        { name: 'Gaseosa Lata', price: 1200, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },
        { name: 'Gaseosa 1.5L', price: 2500, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },
        { name: 'Cerveza Lata', price: 1800, categoryId: categoriesMap.get('Bebidas')!, isStockable: false },

        // Postres
        { name: 'Flan Casero', price: 2000, categoryId: categoriesMap.get('Postres')! },
        { name: 'Helado (2 bochas)', price: 2500, categoryId: categoriesMap.get('Postres')! },
    ];
    for (const p of productsData) {
        await prisma.product.create({
            data: {
                ...p,
                tenantId,
                isStockable: p.isStockable ?? true,
                isActive: true
            }
        });
    }

    // Grupos de Modificadores
    const tamañoPapas = await prisma.modifierGroup.create({
        data: { tenantId, name: 'Tamaño Papas', minSelection: 1, maxSelection: 1 }
    });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: tamañoPapas.id, name: 'Chicas', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: tamañoPapas.id, name: 'Medianas', priceOverlay: 800 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: tamañoPapas.id, name: 'Grandes', priceOverlay: 1500 } });

    const salsasExtra = await prisma.modifierGroup.create({
        data: { tenantId, name: 'Salsas Extra', minSelection: 0, maxSelection: 3 }
    });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: salsasExtra.id, name: 'Chimichurri', priceOverlay: 300 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: salsasExtra.id, name: 'Criolla', priceOverlay: 300 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: salsasExtra.id, name: 'Barbacoa', priceOverlay: 300 } });

    // Áreas y Mesas
    const salon = await prisma.area.create({ data: { tenantId, name: 'Salón' } });
    for (let i = 1; i <= 6; i++) {
        await prisma.table.create({ data: { tenantId, areaId: salon.id, name: `Mesa ${i}`, x: (i-1) * 100, y: 50 } });
    }

    const takeaway = await prisma.area.create({ data: { tenantId, name: 'Para Llevar' } });
    await prisma.table.create({ data: { tenantId, areaId: takeaway.id, name: 'Mostrador' } });

    // Drivers
    await prisma.deliveryDriver.create({
        data: { tenantId, name: 'Martín Repartidor', phone: '11-7777-0001', vehicleType: 'MOTORCYCLE', isActive: true, isAvailable: true }
    });
    await prisma.deliveryDriver.create({
        data: { tenantId, name: 'Lucas Bici', phone: '11-7777-0002', vehicleType: 'BICYCLE', isActive: true, isAvailable: true }
    });

    // Clientes frecuentes
    await prisma.client.create({ data: { tenantId, name: 'Juan Pérez', phone: '11-1234-5678', email: 'juan@email.com', points: 150 } });
    await prisma.client.create({ data: { tenantId, name: 'María García', phone: '11-2345-6789', email: 'maria@email.com', points: 320 } });
    await prisma.client.create({ data: { tenantId, name: 'Empresa ABC', phone: '11-3456-7890', taxId: '30-55555555-5', points: 500 } });

    console.log(`✅ Pollería "El Pollón" creada (Tenant ID: ${tenantId})`);
    return tenantId;
}

// ============================================
// 3. RESTAURANT "GOURMET 42"
// ============================================
async function createRestaurantGourmet() {
    console.log('\n🍽️  Creando Restaurant "Gourmet 42"...');

    const tenant = await prisma.tenant.create({
        data: { name: 'Restaurant Gourmet 42', code: 'gourmet_42', activeSubscription: true }
    });
    const tenantId = tenant.id;

    // Config
    await prisma.tenantConfig.create({
        data: {
            tenantId,
            businessName: 'Gourmet 42 - Cocina de Autor',
            enableStock: true,
            enableDelivery: false, // Restaurant fino, sin delivery
            enableKDS: true,
            enableFiscal: true,
            currencySymbol: '$',
            defaultTaxRate: 21,
            qrMenuEnabled: true,
            qrMenuMode: 'INTERACTIVE'
        }
    });

    // Roles con permisos extendidos para restaurant
    const restaurantRoles = [
        ...standardRoles,
        {
            name: 'SOMMELIER',
            permissions: {
                pos: ['access', 'read'],
                tables: ['access', 'read'],
                orders: ['read', 'update']
            }
        },
        {
            name: 'MAITRE',
            permissions: {
                pos: ['access', 'create', 'read', 'update'],
                tables: ['access', 'create', 'read', 'update'],
                orders: ['create', 'read', 'update'],
                cash: ['access', 'read']
            }
        },
    ];
    const rolesMap = new Map<string, number>();
    for (const r of restaurantRoles) {
        const role = await prisma.role.create({ data: { ...r, tenantId } });
        rolesMap.set(r.name, role.id);
    }

    // Usuarios
    const users = [
        { name: 'Chef Martín Berasategui', email: 'chef@gourmet42.com', pin: '999999', role: 'ADMIN' },
        { name: 'Carla Administración', email: 'admin@gourmet42.com', pin: '888888', role: 'ADMIN' },
        { name: 'Roberto Maître', email: 'maitre@gourmet42.com', pin: '111111', role: 'MAITRE' },
        { name: 'Luciana Sommelier', email: 'vinos@gourmet42.com', pin: '222222', role: 'SOMMELIER' },
        { name: 'Sofía Mozo 1', email: 'mozo1@gourmet42.com', pin: '333333', role: 'MOZO' },
        { name: 'Tomás Mozo 2', email: 'mozo2@gourmet42.com', pin: '444444', role: 'MOZO' },
        { name: 'Federico Cocina', email: 'cocina@gourmet42.com', pin: '555555', role: 'COCINERO' },
        { name: 'Valentina Pastelería', email: 'pasteleria@gourmet42.com', pin: '666666', role: 'COCINERO' },
        { name: 'Ignacio Caja', email: 'caja@gourmet42.com', pin: '777777', role: 'CAJERO' },
    ];
    for (const u of users) {
        const roleId = rolesMap.get(u.role)!;
        const pinHash = await bcrypt.hash(u.pin, 10);
        const pinLookup = generatePinLookup(u.pin);
        await prisma.user.create({
            data: { tenantId, name: u.name, email: u.email, pinHash, pinLookup, roleId, isActive: true }
        });
    }

    // Proveedores premium
    const suppliersData = [
        { name: 'Carnes Premium Angus', phone: '11-5000-0001', email: 'pedidos@carnespremium.com', taxId: '30-60606060-6' },
        { name: 'Pescadería Atlántica', phone: '11-5000-0002', email: 'ventas@atlantica.com', taxId: '30-61616161-7' },
        { name: 'Bodega Catena Zapata', phone: '261-555-0001', email: 'restaurantes@catena.com', taxId: '30-62626262-8' },
        { name: 'Bodega Rutini', phone: '261-555-0002', email: 'hosteleria@rutini.com', taxId: '30-63636363-9' },
        { name: 'Verduras Orgánicas BA', phone: '11-5000-0003', email: 'organicos@verduras.com', taxId: '30-64646464-0' },
        { name: 'Lácteos Artesanales', phone: '11-5000-0004', email: 'quesos@lacteos.com', taxId: '30-65656565-1' },
        { name: 'Importadora Gourmet', phone: '11-5000-0005', email: 'ventas@importadora.com', taxId: '30-66666666-2' },
    ];
    for (const s of suppliersData) {
        await prisma.supplier.create({ data: { ...s, tenantId } });
    }

    // Métodos de pago premium
    const paymentMethods = [
        { code: 'CASH', name: 'Efectivo', icon: 'Banknote', sortOrder: 1 },
        { code: 'CARD', name: 'Tarjeta Crédito/Débito', icon: 'CreditCard', sortOrder: 2 },
        { code: 'TRANSFER', name: 'Transferencia Bancaria', icon: 'Building', sortOrder: 3 },
        { code: 'QR_INTEGRATED', name: 'Pago Digital QR', icon: 'QrCode', sortOrder: 4 },
    ];
    for (const pm of paymentMethods) {
        await prisma.paymentMethodConfig.create({ data: { ...pm, tenantId, isActive: true } });
    }

    // Tasas de IVA
    await prisma.taxRate.create({ data: { tenantId, name: 'IVA 21%', rate: 21, isDefault: true, isActive: true } });
    await prisma.taxRate.create({ data: { tenantId, name: 'IVA 10.5%', rate: 10.5, isDefault: false, isActive: true } });
    await prisma.taxRate.create({ data: { tenantId, name: 'Exento', rate: 0, isDefault: false, isActive: true } });

    // Impresoras
    const cocinaCaliente = await prisma.printer.create({
        data: { tenantId, name: 'Cocina Caliente', connectionType: 'NETWORK', ipAddress: '192.168.2.100' }
    });
    const cocinaFria = await prisma.printer.create({
        data: { tenantId, name: 'Cocina Fría', connectionType: 'NETWORK', ipAddress: '192.168.2.101' }
    });
    const pasteleria = await prisma.printer.create({
        data: { tenantId, name: 'Pastelería', connectionType: 'NETWORK', ipAddress: '192.168.2.102' }
    });
    const bar = await prisma.printer.create({
        data: { tenantId, name: 'Bar', connectionType: 'NETWORK', ipAddress: '192.168.2.103' }
    });
    const caja = await prisma.printer.create({
        data: { tenantId, name: 'Caja Principal', connectionType: 'NETWORK', ipAddress: '192.168.2.104' }
    });

    // Categorías
    const categoriesData = [
        { name: 'Entradas Frías', printerId: cocinaFria.id },
        { name: 'Entradas Calientes', printerId: cocinaCaliente.id },
        { name: 'Ensaladas', printerId: cocinaFria.id },
        { name: 'Pastas', printerId: cocinaCaliente.id },
        { name: 'Carnes', printerId: cocinaCaliente.id },
        { name: 'Pescados y Mariscos', printerId: cocinaCaliente.id },
        { name: 'Guarniciones', printerId: cocinaCaliente.id },
        { name: 'Postres', printerId: pasteleria.id },
        { name: 'Cafetería', printerId: bar.id },
        { name: 'Vinos Tintos', printerId: bar.id },
        { name: 'Vinos Blancos', printerId: bar.id },
        { name: 'Champagne y Espumantes', printerId: bar.id },
        { name: 'Cócteles', printerId: bar.id },
        { name: 'Bebidas Sin Alcohol', printerId: bar.id },
        { name: 'Digestivos', printerId: bar.id },
    ];
    const categoriesMap = new Map<string, number>();
    for (const c of categoriesData) {
        const cat = await prisma.category.create({ data: { ...c, tenantId } });
        categoriesMap.set(c.name, cat.id);
    }

    // Ingredientes premium
    const ingredientsData = [
        // Carnes
        { name: 'Lomo Angus', unit: 'kg', cost: 18000, stock: 20, minStock: 5 },
        { name: 'Bife de Chorizo', unit: 'kg', cost: 16000, stock: 25, minStock: 5 },
        { name: 'Ojo de Bife', unit: 'kg', cost: 22000, stock: 15, minStock: 3 },
        { name: 'Cordero Patagónico', unit: 'kg', cost: 14000, stock: 10, minStock: 2 },
        { name: 'Pato', unit: 'u', cost: 8000, stock: 8, minStock: 2 },

        // Pescados
        { name: 'Salmón Fresco', unit: 'kg', cost: 15000, stock: 10, minStock: 2 },
        { name: 'Merluza Negra', unit: 'kg', cost: 12000, stock: 8, minStock: 2 },
        { name: 'Langostinos', unit: 'kg', cost: 18000, stock: 5, minStock: 1 },
        { name: 'Pulpo', unit: 'kg', cost: 16000, stock: 5, minStock: 1 },
        { name: 'Vieiras', unit: 'kg', cost: 25000, stock: 3, minStock: 1 },

        // Verduras y Hongos
        { name: 'Espárragos', unit: 'atado', cost: 2500, stock: 20, minStock: 5 },
        { name: 'Hongos Portobello', unit: 'kg', cost: 4500, stock: 8, minStock: 2 },
        { name: 'Trufas Negras', unit: 'g', cost: 500, stock: 100, minStock: 20 },
        { name: 'Mix de Hojas', unit: 'kg', cost: 3000, stock: 15, minStock: 3 },
        { name: 'Tomate Cherry', unit: 'kg', cost: 2800, stock: 10, minStock: 2 },

        // Lácteos y Quesos
        { name: 'Burrata', unit: 'u', cost: 3500, stock: 15, minStock: 3 },
        { name: 'Parmigiano Reggiano', unit: 'kg', cost: 15000, stock: 5, minStock: 1 },
        { name: 'Gorgonzola', unit: 'kg', cost: 9000, stock: 3, minStock: 1 },
        { name: 'Crema de Leche', unit: 'lt', cost: 2000, stock: 20, minStock: 5 },
        { name: 'Manteca', unit: 'kg', cost: 3500, stock: 10, minStock: 2 },

        // Pastas frescas
        { name: 'Pasta Fresca Tallarines', unit: 'kg', cost: 2500, stock: 15, minStock: 3 },
        { name: 'Pasta Fresca Ravioles', unit: 'kg', cost: 3500, stock: 10, minStock: 2 },
        { name: 'Ñoquis Frescos', unit: 'kg', cost: 2000, stock: 10, minStock: 2 },

        // Otros
        { name: 'Aceite de Oliva EVOO', unit: 'lt', cost: 4500, stock: 20, minStock: 5 },
        { name: 'Vinagre Balsámico Modena', unit: 'lt', cost: 8000, stock: 5, minStock: 1 },
        { name: 'Foie Gras', unit: 'kg', cost: 35000, stock: 2, minStock: 1 },
    ];
    for (const i of ingredientsData) {
        await prisma.ingredient.create({ data: { ...i, tenantId } });
    }

    // Productos - Menú Gourmet
    const productsData = [
        // Entradas Frías
        { name: 'Carpaccio de Lomo con Rúcula y Parmesano', price: 8500, categoryId: categoriesMap.get('Entradas Frías')!, description: 'Finas láminas de lomo, rúcula fresca, lascas de parmigiano y aceite de oliva' },
        { name: 'Burrata con Tomates Confitados', price: 9200, categoryId: categoriesMap.get('Entradas Frías')!, description: 'Burrata cremosa, tomates cherry confitados, albahaca y reducción balsámica' },
        { name: 'Tartar de Salmón', price: 9800, categoryId: categoriesMap.get('Entradas Frías')!, description: 'Salmón fresco, palta, ciboulette y chips de wonton' },
        { name: 'Foie Gras Mi-Cuit', price: 14500, categoryId: categoriesMap.get('Entradas Frías')!, description: 'Foie gras semi-cocido con compota de higos y brioche tostado' },

        // Entradas Calientes
        { name: 'Vieiras Gratinadas', price: 11500, categoryId: categoriesMap.get('Entradas Calientes')!, description: 'Vieiras con manteca de hierbas y gratinado de parmesano' },
        { name: 'Hongos Portobello Rellenos', price: 7200, categoryId: categoriesMap.get('Entradas Calientes')!, description: 'Portobello relleno de espinaca, queso de cabra y nueces' },
        { name: 'Langostinos al Ajillo', price: 10800, categoryId: categoriesMap.get('Entradas Calientes')!, description: 'Langostinos salteados con ajo, guindilla y aceite de oliva' },

        // Ensaladas
        { name: 'Ensalada Caesar Gourmet', price: 6500, categoryId: categoriesMap.get('Ensaladas')!, description: 'Lechuga romana, pollo grillado, croutons, parmesano y aderezo caesar' },
        { name: 'Ensalada de Rúcula y Peras', price: 7200, categoryId: categoriesMap.get('Ensaladas')!, description: 'Rúcula, peras caramelizadas, gorgonzola, nueces y vinagreta de miel' },
        { name: 'Ensalada Mediterránea', price: 6800, categoryId: categoriesMap.get('Ensaladas')!, description: 'Mix de hojas, tomate, pepino, aceitunas, feta y orégano' },

        // Pastas
        { name: 'Tallarines al Huevo con Ragú de Cordero', price: 11500, categoryId: categoriesMap.get('Pastas')!, description: 'Pasta fresca con ragú de cordero braseado 8 horas' },
        { name: 'Ravioles de Calabaza y Salvia', price: 9800, categoryId: categoriesMap.get('Pastas')!, description: 'Ravioles caseros, manteca dorada, salvia crocante y parmesano' },
        { name: 'Ñoquis de Papa con Crema de Hongos', price: 9200, categoryId: categoriesMap.get('Pastas')!, description: 'Ñoquis artesanales con crema de hongos de estación' },
        { name: 'Risotto de Langostinos y Azafrán', price: 13500, categoryId: categoriesMap.get('Pastas')!, description: 'Arroz carnaroli, langostinos, azafrán y mantecado al parmesano' },
        { name: 'Risotto Nero', price: 14200, categoryId: categoriesMap.get('Pastas')!, description: 'Risotto con tinta de calamar, mariscos y limón' },

        // Carnes
        { name: 'Lomo al Malbec', price: 16500, categoryId: categoriesMap.get('Carnes')!, description: 'Medallón de lomo angus, reducción de malbec y puré trufado' },
        { name: 'Bife de Chorizo 400g', price: 14800, categoryId: categoriesMap.get('Carnes')!, description: 'Corte premium a la parrilla, chimichurri y papas soufflé' },
        { name: 'Ojo de Bife con Manteca de Hierbas', price: 17500, categoryId: categoriesMap.get('Carnes')!, description: 'Corte de 350g, manteca compuesta y vegetales grillados' },
        { name: 'Carré de Cordero', price: 18500, categoryId: categoriesMap.get('Carnes')!, description: 'Cordero patagónico con costra de hierbas y ratatouille' },
        { name: 'Magret de Pato', price: 15200, categoryId: categoriesMap.get('Carnes')!, description: 'Pechuga de pato rosada, salsa de frutos rojos y puré de batata' },

        // Pescados
        { name: 'Salmón Atlántico Glaseado', price: 14500, categoryId: categoriesMap.get('Pescados y Mariscos')!, description: 'Salmón con glaseado de miso, pak choi y arroz jazmín' },
        { name: 'Merluza Negra a la Plancha', price: 16800, categoryId: categoriesMap.get('Pescados y Mariscos')!, description: 'Merluza negra, espárragos, alcaparras y beurre blanc' },
        { name: 'Pulpo a la Parrilla', price: 15500, categoryId: categoriesMap.get('Pescados y Mariscos')!, description: 'Pulpo tiernizado, papas andinas, pimentón y alioli' },

        // Guarniciones
        { name: 'Papas Soufflé', price: 3200, categoryId: categoriesMap.get('Guarniciones')! },
        { name: 'Puré Trufado', price: 4500, categoryId: categoriesMap.get('Guarniciones')! },
        { name: 'Vegetales Grillados', price: 3500, categoryId: categoriesMap.get('Guarniciones')! },
        { name: 'Espárragos a la Plancha', price: 4200, categoryId: categoriesMap.get('Guarniciones')! },
        { name: 'Hongos Salteados', price: 3800, categoryId: categoriesMap.get('Guarniciones')! },

        // Postres
        { name: 'Volcán de Chocolate', price: 5500, categoryId: categoriesMap.get('Postres')!, description: 'Bizcocho de chocolate con centro fundente y helado de vainilla' },
        { name: 'Crème Brûlée', price: 4800, categoryId: categoriesMap.get('Postres')!, description: 'Clásica crema quemada con caramelo crocante' },
        { name: 'Tiramisú de la Casa', price: 5200, categoryId: categoriesMap.get('Postres')!, description: 'Receta tradicional italiana con mascarpone y café espresso' },
        { name: 'Cheesecake de Frutos Rojos', price: 5500, categoryId: categoriesMap.get('Postres')!, description: 'Cheesecake cremoso con coulis de frutos rojos' },
        { name: 'Tabla de Quesos Artesanales', price: 8500, categoryId: categoriesMap.get('Postres')!, description: 'Selección de 5 quesos, membrillo, nueces y pan de campo' },
        { name: 'Helados Artesanales (3 bochas)', price: 4200, categoryId: categoriesMap.get('Postres')! },

        // Cafetería
        { name: 'Café Espresso', price: 1800, categoryId: categoriesMap.get('Cafetería')!, isStockable: false },
        { name: 'Café Doble', price: 2200, categoryId: categoriesMap.get('Cafetería')!, isStockable: false },
        { name: 'Cappuccino', price: 2800, categoryId: categoriesMap.get('Cafetería')!, isStockable: false },
        { name: 'Té Premium (selección)', price: 2500, categoryId: categoriesMap.get('Cafetería')!, isStockable: false },

        // Vinos Tintos
        { name: 'Catena Zapata Malbec', price: 18500, categoryId: categoriesMap.get('Vinos Tintos')!, isStockable: false, description: 'Mendoza - Cuerpo pleno, notas de ciruela y especias' },
        { name: 'Rutini Cabernet Malbec', price: 14500, categoryId: categoriesMap.get('Vinos Tintos')!, isStockable: false },
        { name: 'Luigi Bosca DOC', price: 12500, categoryId: categoriesMap.get('Vinos Tintos')!, isStockable: false },
        { name: 'Alamos Malbec (copa)', price: 3500, categoryId: categoriesMap.get('Vinos Tintos')!, isStockable: false },
        { name: 'Vino de la Casa Tinto', price: 8500, categoryId: categoriesMap.get('Vinos Tintos')!, isStockable: false },

        // Vinos Blancos
        { name: 'Catena Chardonnay', price: 15500, categoryId: categoriesMap.get('Vinos Blancos')!, isStockable: false },
        { name: 'Rutini Sauvignon Blanc', price: 12500, categoryId: categoriesMap.get('Vinos Blancos')!, isStockable: false },
        { name: 'Alamos Torrontés (copa)', price: 3200, categoryId: categoriesMap.get('Vinos Blancos')!, isStockable: false },
        { name: 'Vino de la Casa Blanco', price: 7500, categoryId: categoriesMap.get('Vinos Blancos')!, isStockable: false },

        // Champagne
        { name: 'Chandon Brut', price: 14500, categoryId: categoriesMap.get('Champagne y Espumantes')!, isStockable: false },
        { name: 'Chandon Rosé', price: 15500, categoryId: categoriesMap.get('Champagne y Espumantes')!, isStockable: false },
        { name: 'Baron B', price: 22000, categoryId: categoriesMap.get('Champagne y Espumantes')!, isStockable: false },
        { name: 'Copa de Espumante', price: 4500, categoryId: categoriesMap.get('Champagne y Espumantes')!, isStockable: false },

        // Cócteles
        { name: 'Negroni', price: 6500, categoryId: categoriesMap.get('Cócteles')!, isStockable: false },
        { name: 'Aperol Spritz', price: 6200, categoryId: categoriesMap.get('Cócteles')!, isStockable: false },
        { name: 'Old Fashioned', price: 7500, categoryId: categoriesMap.get('Cócteles')!, isStockable: false },
        { name: 'Gin Tonic Premium', price: 7200, categoryId: categoriesMap.get('Cócteles')!, isStockable: false },
        { name: 'Moscow Mule', price: 6500, categoryId: categoriesMap.get('Cócteles')!, isStockable: false },

        // Bebidas sin alcohol
        { name: 'Agua Mineral 500ml', price: 1200, categoryId: categoriesMap.get('Bebidas Sin Alcohol')!, isStockable: false },
        { name: 'Agua con Gas 500ml', price: 1200, categoryId: categoriesMap.get('Bebidas Sin Alcohol')!, isStockable: false },
        { name: 'Limonada de la Casa', price: 2800, categoryId: categoriesMap.get('Bebidas Sin Alcohol')!, isStockable: false },
        { name: 'Jugo Natural (naranja/pomelo)', price: 3200, categoryId: categoriesMap.get('Bebidas Sin Alcohol')!, isStockable: false },
        { name: 'Gaseosa Premium', price: 1800, categoryId: categoriesMap.get('Bebidas Sin Alcohol')!, isStockable: false },

        // Digestivos
        { name: 'Fernet Branca', price: 4500, categoryId: categoriesMap.get('Digestivos')!, isStockable: false },
        { name: 'Limoncello', price: 4200, categoryId: categoriesMap.get('Digestivos')!, isStockable: false },
        { name: 'Grappa', price: 5500, categoryId: categoriesMap.get('Digestivos')!, isStockable: false },
        { name: 'Cognac VS', price: 7500, categoryId: categoriesMap.get('Digestivos')!, isStockable: false },
    ];
    for (const p of productsData) {
        await prisma.product.create({
            data: {
                name: p.name,
                price: p.price,
                categoryId: p.categoryId,
                description: p.description || null,
                tenantId,
                isStockable: p.isStockable ?? true,
                isActive: true
            }
        });
    }

    // Grupos de Modificadores
    const puntoCarne = await prisma.modifierGroup.create({
        data: { tenantId, name: 'Punto de Cocción', minSelection: 1, maxSelection: 1 }
    });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: puntoCarne.id, name: 'Jugoso', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: puntoCarne.id, name: 'A Punto', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: puntoCarne.id, name: 'Cocido', priceOverlay: 0 } });

    const guarnicionIncluida = await prisma.modifierGroup.create({
        data: { tenantId, name: 'Guarnición Incluida', minSelection: 1, maxSelection: 1 }
    });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: guarnicionIncluida.id, name: 'Papas Soufflé', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: guarnicionIncluida.id, name: 'Puré Clásico', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: guarnicionIncluida.id, name: 'Vegetales Grillados', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: guarnicionIncluida.id, name: 'Puré Trufado', priceOverlay: 1500 } });

    const bochHelado = await prisma.modifierGroup.create({
        data: { tenantId, name: 'Sabores de Helado', minSelection: 1, maxSelection: 3 }
    });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: bochHelado.id, name: 'Vainilla', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: bochHelado.id, name: 'Chocolate Belga', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: bochHelado.id, name: 'Dulce de Leche', priceOverlay: 0 } });
    await prisma.modifierOption.create({ data: { tenantId, modifierGroupId: bochHelado.id, name: 'Frutos del Bosque', priceOverlay: 0 } });

    // Áreas y Mesas
    const salonPrincipal = await prisma.area.create({ data: { tenantId, name: 'Salón Principal' } });
    for (let i = 1; i <= 10; i++) {
        await prisma.table.create({
            data: { tenantId, areaId: salonPrincipal.id, name: `Mesa ${i}`, x: ((i-1) % 5) * 120, y: Math.floor((i-1) / 5) * 100 }
        });
    }

    const salonPrivado = await prisma.area.create({ data: { tenantId, name: 'Salón Privado' } });
    await prisma.table.create({ data: { tenantId, areaId: salonPrivado.id, name: 'Mesa VIP 1' } });
    await prisma.table.create({ data: { tenantId, areaId: salonPrivado.id, name: 'Mesa VIP 2' } });

    const terraza = await prisma.area.create({ data: { tenantId, name: 'Terraza' } });
    for (let i = 1; i <= 6; i++) {
        await prisma.table.create({ data: { tenantId, areaId: terraza.id, name: `Terraza ${i}` } });
    }

    const barArea = await prisma.area.create({ data: { tenantId, name: 'Barra' } });
    await prisma.table.create({ data: { tenantId, areaId: barArea.id, name: 'Barra 1' } });
    await prisma.table.create({ data: { tenantId, areaId: barArea.id, name: 'Barra 2' } });
    await prisma.table.create({ data: { tenantId, areaId: barArea.id, name: 'Barra 3' } });

    // Clientes VIP
    await prisma.client.create({ data: { tenantId, name: 'Dr. Roberto Fernández', phone: '11-9999-0001', email: 'roberto@email.com', points: 2500 } });
    await prisma.client.create({ data: { tenantId, name: 'Lic. Carolina Méndez', phone: '11-9999-0002', email: 'carolina@empresa.com', points: 1800 } });
    await prisma.client.create({ data: { tenantId, name: 'Estudio Jurídico ABC', phone: '11-9999-0003', taxId: '30-77777777-7', points: 5000 } });
    await prisma.client.create({ data: { tenantId, name: 'Corporación Tech SA', phone: '11-9999-0004', taxId: '30-88888888-8', points: 8500 } });

    console.log(`✅ Restaurant "Gourmet 42" creado (Tenant ID: ${tenantId})`);
    return tenantId;
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.log('🚀 SEED DEMO COMPLETO');
    console.log('=====================\n');

    await clearDatabase();

    const rotiseriaId = await createRotiseria();
    const polleriaId = await createPolleria();
    const gourmetId = await createRestaurantGourmet();

    console.log('\n=====================');
    console.log('✅ SEED COMPLETADO\n');
    console.log('TENANTS CREADOS:');
    console.log(`  1. Rotisería "La Gorda"    - ID: ${rotiseriaId} - PIN Admin: 999999`);
    console.log(`  2. Pollería "El Pollón"    - ID: ${polleriaId} - PIN Admin: 999999`);
    console.log(`  3. Restaurant "Gourmet 42" - ID: ${gourmetId} - PIN Admin: 999999`);
    console.log('\n');
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
