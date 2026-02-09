/**
 * @fileoverview Seed: 3 Distinct Business Profiles
 *
 * Creates 3 tenants that represent fundamentally different restaurant
 * operations. Each one exercises a unique combination of feature flags,
 * roles, menu complexity, and order flows — giving broad coverage when
 * testing the application end-to-end.
 *
 * ┌─────────────────────┬────────────────────┬─────────────────────────┐
 * │ La Esquina Café      │ Fuego Parrilla     │ Tokyo Express           │
 * │ (small, simple)      │ (mid-size, complex)│ (delivery-first, dark)  │
 * ├─────────────────────┼────────────────────┼─────────────────────────┤
 * │ Owner does it all    │ Full brigade staff │ Ghost kitchen, no FOH   │
 * │ No KDS, no delivery  │ Multi-station KDS  │ 3 delivery platforms    │
 * │ 4 tables, short menu │ 12 tables, 2 areas │ 0 tables, QR pickup    │
 * │ Cash only            │ All payment methods│ Card + digital only     │
 * │ No stock tracking    │ Full inventory     │ Lean inventory          │
 * └─────────────────────┴────────────────────┴─────────────────────────┘
 *
 * Run:  npx ts-node prisma/seed-profiles.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me_in_production_please_32chars';
const PIN_HMAC_SECRET = process.env.PIN_HMAC_SECRET || JWT_SECRET;

function pinLookup(pin: string): string {
    return crypto.createHmac('sha256', PIN_HMAC_SECRET).update(pin).digest('hex');
}

async function hashPin(pin: string) {
    return {
        pinHash: await bcrypt.hash(pin, BCRYPT_ROUNDS),
        pinLookup: pinLookup(pin),
    };
}

async function hashPassword(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Find-or-create pattern used throughout to make the seed re-runnable. */
async function findOrCreate<T extends { id: number }>(
    find: () => Promise<T | null>,
    create: () => Promise<T>,
): Promise<T> {
    const existing = await find();
    if (existing) return existing;
    try {
        return await create();
    } catch (e: any) {
        if (e?.code === 'P2002') {
            const retry = await find();
            if (retry) return retry;
        }
        throw e;
    }
}

/** Find or create a user, and always refresh credentials (pinHash, pinLookup, passwordHash). */
async function findOrCreateUser(
    tenantId: number,
    email: string,
    data: { name: string; passwordHash: string; pinHash: string; pinLookup: string; roleId: number },
) {
    const existing = await prisma.user.findFirst({ where: { tenantId, email } });
    if (existing) {
        // Always refresh credentials so re-runs pick up secret changes
        return prisma.user.update({
            where: { id: existing.id },
            data: { pinHash: data.pinHash, pinLookup: data.pinLookup, passwordHash: data.passwordHash, roleId: data.roleId },
        });
    }
    try {
        return await prisma.user.create({
            data: { tenantId, email, isActive: true, ...data },
        });
    } catch (e: any) {
        if (e?.code === 'P2002') {
            const retry = await prisma.user.findFirst({ where: { tenantId, email } });
            if (retry) return retry;
        }
        throw e;
    }
}

/** Swallow unique-constraint errors (P2002) — makes creates idempotent. */
async function ignoreDuplicate<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch (e: any) {
        if (e?.code === 'P2002') return null;
        throw e;
    }
}

function today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function sequenceKey(tenantId: number): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `TENANT_${tenantId}_DATE_${yyyy}${mm}${dd}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE 1 — La Esquina Café
//
// Who: Marta, 58. Owns a 4-table neighbourhood café in a quiet residential
//      block. She bakes her own pastries at 5 AM and serves them alongside
//      simple sandwiches, coffee, and fresh juice until 6 PM.
//
// Style: Warm, old-school, paper-napkin vibes. She resisted going digital
//        for years and only adopted POS because her accountant insisted.
//        She wants the absolute minimum number of screens and buttons.
//
// Pain points:
//   - Technophobic — anything beyond PIN login + take order + collect cash
//     feels overwhelming.
//   - Runs the place alone most mornings; her nephew helps on weekends.
//   - Doesn't want stock alerts, KDS screens, or delivery dashboards
//     cluttering her view.
//   - Needs end-of-day cash count to match her old paper system.
//
// What this exercises:
//   - Minimal feature flags (stock OFF, delivery OFF, KDS OFF)
//   - Single-role usage (owner = admin + cashier + waiter)
//   - Small product catalog with NO modifiers
//   - Cash-only payments
//   - Simple order lifecycle: OPEN → PAID → done
// ═══════════════════════════════════════════════════════════════════════════

async function seedLaEsquinaCafe() {
    console.log('\n☕ Seeding Profile 1: La Esquina Café...');

    // --- Tenant ---
    const tenant = await prisma.tenant.upsert({
        where: { id: 10 },
        update: {},
        create: { id: 10, name: 'La Esquina Café', code: 'esquina' },
    });
    const T = tenant.id;

    // --- Config: stripped-down, cash-focused ---
    await prisma.tenantConfig.upsert({
        where: { id: 10 },
        update: {},
        create: {
            id: 10,
            tenantId: T,
            businessName: 'La Esquina Café',
            currencySymbol: '$',
            enableStock: false,
            enableDelivery: false,
            enableKDS: false,
            enableFiscal: false,
        },
    });

    // --- Roles ---
    const ownerPerms = {
        pos: ['access', 'create', 'read', 'update', 'delete'],
        tables: ['access', 'create', 'read', 'update'],
        cash: ['access', 'create', 'read', 'update'],
        admin: ['access'],
        orders: ['create', 'read', 'update', 'delete'],
        products: ['create', 'read', 'update', 'delete'],
        users: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update'],
    };
    const helperPerms = {
        pos: ['access', 'create', 'read'],
        tables: ['access', 'read'],
        cash: ['access', 'read'],
        orders: ['create', 'read'],
    };

    const ownerRole = await findOrCreate(
        () => prisma.role.findFirst({ where: { tenantId: T, name: 'ADMIN' } }),
        () => prisma.role.create({ data: { tenantId: T, name: 'ADMIN', permissions: ownerPerms } }),
    );
    const helperRole = await findOrCreate(
        () => prisma.role.findFirst({ where: { tenantId: T, name: 'CASHIER' } }),
        () => prisma.role.create({ data: { tenantId: T, name: 'CASHIER', permissions: helperPerms } }),
    );

    // --- Users ---
    const passwordHash = await hashPassword('marta2026');

    const martaPin = await hashPin('100100');
    await findOrCreateUser(T, 'marta@esquina.com', {
        name: 'Marta Gutiérrez', passwordHash, ...martaPin, roleId: ownerRole.id,
    });

    const tomasPin = await hashPin('100200');
    await findOrCreateUser(T, 'tomas@esquina.com', {
        name: 'Tomás Gutiérrez', passwordHash, ...tomasPin, roleId: helperRole.id,
    });

    // --- Categories ---
    const cats = ['Cafetería', 'Pastelería', 'Sándwiches', 'Jugos'] as const;
    const catMap = new Map<string, number>();
    for (const name of cats) {
        const c = await findOrCreate(
            () => prisma.category.findFirst({ where: { tenantId: T, name } }),
            () => prisma.category.create({ data: { tenantId: T, name } }),
        );
        catMap.set(name, c.id);
    }

    // --- Products (no modifiers, no recipes — stock is OFF) ---
    const products = [
        { name: 'Café con Leche',     price: 2.50,  cat: 'Cafetería' },
        { name: 'Cortado',            price: 2.00,  cat: 'Cafetería' },
        { name: 'Té con Limón',       price: 2.00,  cat: 'Cafetería' },
        { name: 'Medialuna',          price: 1.20,  cat: 'Pastelería' },
        { name: 'Tarta de Manzana',   price: 3.50,  cat: 'Pastelería' },
        { name: 'Budín de Limón',     price: 3.00,  cat: 'Pastelería' },
        { name: 'Tostado J&Q',        price: 4.50,  cat: 'Sándwiches' },
        { name: 'Sándwich de Miga',   price: 3.00,  cat: 'Sándwiches' },
        { name: 'Jugo de Naranja',    price: 3.50,  cat: 'Jugos' },
        { name: 'Limonada',           price: 3.00,  cat: 'Jugos' },
    ];

    for (const p of products) {
        await findOrCreate(
            () => prisma.product.findFirst({ where: { tenantId: T, name: p.name } }),
            () =>
                prisma.product.create({
                    data: {
                        tenantId: T,
                        name: p.name,
                        price: p.price,
                        categoryId: catMap.get(p.cat)!,
                        productType: 'SIMPLE',
                        isStockable: false,
                    },
                }),
        );
    }

    // --- Area & Tables (small — 4 tables in one room) ---
    const area = await findOrCreate(
        () => prisma.area.findFirst({ where: { tenantId: T, name: 'Salón' } }),
        () => prisma.area.create({ data: { tenantId: T, name: 'Salón' } }),
    );

    for (let i = 1; i <= 4; i++) {
        const name = `Mesa ${i}`;
        await findOrCreate(
            () => prisma.table.findFirst({ where: { tenantId: T, name } }),
            () =>
                prisma.table.create({
                    data: { tenantId: T, name, areaId: area.id, x: (i - 1) * 150, y: 80 },
                }),
        );
    }

    // --- Payment methods: cash only ---
    await findOrCreate(
        () => prisma.paymentMethodConfig.findFirst({ where: { tenantId: T, code: 'CASH' } }),
        () =>
            prisma.paymentMethodConfig.create({
                data: { tenantId: T, code: 'CASH', name: 'Efectivo', icon: 'DollarSign', isActive: true, sortOrder: 1 },
            }),
    );

    // --- Open shift for Marta ---
    const marta = await prisma.user.findFirst({ where: { tenantId: T, email: 'marta@esquina.com' } });
    if (marta) {
        const openShift = await prisma.cashShift.findFirst({ where: { tenantId: T, userId: marta.id, endTime: null } });
        if (!openShift) {
            await ignoreDuplicate(() => prisma.cashShift.create({
                data: { tenantId: T, userId: marta.id, startAmount: 5000, businessDate: today(), startTime: new Date() },
            }));
        }
    }

    // --- Sample order: a simple breakfast ticket already paid ---
    const cafe = await prisma.product.findFirst({ where: { tenantId: T, name: 'Café con Leche' } });
    const medialuna = await prisma.product.findFirst({ where: { tenantId: T, name: 'Medialuna' } });
    const table1 = await prisma.table.findFirst({ where: { tenantId: T, name: 'Mesa 1' } });

    if (marta && cafe && medialuna && table1) {
        const sub = Number(cafe.price) + Number(medialuna.price) * 3;
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: 1,
                channel: 'POS',
                status: 'DELIVERED',
                paymentStatus: 'PAID',
                subtotal: sub,
                total: sub,
                businessDate: today(),
                tableId: table1.id,
                serverId: marta.id,
                items: {
                    create: [
                        { tenantId: T, productId: cafe.id, quantity: 1, unitPrice: Number(cafe.price), status: 'SERVED' },
                        { tenantId: T, productId: medialuna.id, quantity: 3, unitPrice: Number(medialuna.price), status: 'SERVED' },
                    ],
                },
            },
        }));
    }

    // --- Sequence ---
    const seqKey = sequenceKey(T);
    await findOrCreate(
        () => prisma.orderSequence.findFirst({ where: { tenantId: T, sequenceKey: seqKey } }),
        () => prisma.orderSequence.create({ data: { tenantId: T, sequenceKey: seqKey, currentValue: 1 } }),
    );

    console.log('  ✅ La Esquina Café ready  (PIN marta: 100100 | tomas: 100200)');
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE 2 — Fuego Parrilla
//
// Who: Diego, 34. A classically trained chef who opened a mid-upscale
//      steakhouse with his business partner (Lucía, floor manager).
//      They run a tight 15-person brigade across two shifts.
//
// Style: Ambitious, detail-oriented, borderline perfectionist. Diego
//        obsesses over ticket times. Lucía tracks every peso of inventory
//        shrinkage. They want the system to surface problems before the
//        staff even notices.
//
// Pain points:
//   - KDS latency — steak doneness modifiers MUST reach the grill station
//     within seconds or meat comes out wrong.
//   - Split bills on large tables (8-tops with separate checks).
//   - Tracking expensive cuts (inventory cost control is existential).
//   - Weekend delivery surge from Rappi/PedidosYa on top of a full house.
//
// What this exercises:
//   - ALL feature flags ON (stock, delivery, KDS, fiscal)
//   - Multiple KDS stations (Parrilla, Cocina Fría, Barra)
//   - Complex modifier groups (doneness, extras, sides)
//   - Full RBAC: admin, cashier, 2 waiters, kitchen, delivery
//   - Delivery platforms with channel-specific pricing
//   - Multi-area layout (Salón + Terraza, 12 tables total)
//   - Ingredient recipes with cost tracking
//   - Tax rates for fiscal invoicing
//   - Full payment method suite (cash, card, transfer, QR)
// ═══════════════════════════════════════════════════════════════════════════

async function seedFuegoParrilla() {
    console.log('\n🔥 Seeding Profile 2: Fuego Parrilla...');

    // --- Tenant ---
    const tenant = await prisma.tenant.upsert({
        where: { id: 20 },
        update: {},
        create: { id: 20, name: 'Fuego Parrilla', code: 'fuego' },
    });
    const T = tenant.id;

    // --- Config: everything ON ---
    await prisma.tenantConfig.upsert({
        where: { id: 20 },
        update: {},
        create: {
            id: 20,
            tenantId: T,
            businessName: 'Fuego Parrilla',
            currencySymbol: '$',
            enableStock: true,
            enableDelivery: true,
            enableKDS: true,
            enableFiscal: true,
            defaultTaxRate: 21.0,
        },
    });

    // --- Roles (full brigade) ---
    const rolesData: { name: string; permissions: Record<string, string[]> }[] = [
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
                settings: ['read', 'update'],
            },
        },
        {
            name: 'CASHIER',
            permissions: {
                pos: ['access', 'create', 'read'],
                cash: ['access', 'create', 'read', 'update'],
                tables: ['access', 'read'],
                orders: ['create', 'read', 'update'],
            },
        },
        {
            name: 'WAITER',
            permissions: {
                pos: ['access', 'create', 'read', 'update'],
                tables: ['access', 'read', 'update'],
                orders: ['create', 'read', 'update'],
            },
        },
        {
            name: 'KITCHEN',
            permissions: {
                kds: ['access'],
                orders: ['read', 'update'],
            },
        },
        {
            name: 'DELIVERY',
            permissions: {
                delivery: ['access'],
                orders: ['read', 'update'],
            },
        },
    ];

    const roleMap = new Map<string, number>();
    for (const r of rolesData) {
        const role = await findOrCreate(
            () => prisma.role.findFirst({ where: { tenantId: T, name: r.name } }),
            () => prisma.role.create({ data: { tenantId: T, name: r.name, permissions: r.permissions } }),
        );
        roleMap.set(r.name, role.id);
    }

    // --- Users ---
    const usersData = [
        { name: 'Diego Romero',    email: 'diego@fuego.com',   pin: '200100', password: 'diego2026',  role: 'ADMIN' },
        { name: 'Lucía Fernández', email: 'lucia@fuego.com',   pin: '200200', password: 'lucia2026',  role: 'ADMIN' },
        { name: 'Carolina Díaz',   email: 'caro@fuego.com',    pin: '200300', password: 'caro2026',   role: 'CASHIER' },
        { name: 'Ramiro Sosa',     email: 'ramiro@fuego.com',  pin: '200400', password: 'ramiro2026', role: 'WAITER' },
        { name: 'Valentina Ruiz',  email: 'vale@fuego.com',    pin: '200500', password: 'vale2026',   role: 'WAITER' },
        { name: 'El Negro Páez',   email: 'negro@fuego.com',   pin: '200600', password: 'negro2026',  role: 'KITCHEN' },
        { name: 'Facundo López',   email: 'facu@fuego.com',    pin: '200700', password: 'facu2026',   role: 'DELIVERY' },
    ];

    for (const u of usersData) {
        const pin = await hashPin(u.pin);
        const pwHash = await hashPassword(u.password);
        await findOrCreateUser(T, u.email, {
            name: u.name, passwordHash: pwHash, ...pin, roleId: roleMap.get(u.role)!,
        });
    }

    // --- KDS Stations ---
    const kdsStations = [
        { name: 'Parrilla',     code: 'GRILL',  sortOrder: 1, isDefault: true },
        { name: 'Cocina Fría',  code: 'COLD',   sortOrder: 2, isDefault: false },
        { name: 'Barra',        code: 'BAR',    sortOrder: 3, isDefault: false },
    ];
    const kdsMap = new Map<string, number>();
    for (const s of kdsStations) {
        const station = await findOrCreate(
            () => prisma.kdsStation.findFirst({ where: { tenantId: T, code: s.code } }),
            () => prisma.kdsStation.create({ data: { tenantId: T, ...s } }),
        );
        kdsMap.set(s.code, station.id);
    }

    // --- Categories (linked to KDS stations) ---
    const categoriesData = [
        { name: 'Parrilla',      kds: 'GRILL' },
        { name: 'Achuras',       kds: 'GRILL' },
        { name: 'Ensaladas',     kds: 'COLD' },
        { name: 'Entradas',      kds: 'COLD' },
        { name: 'Postres',       kds: 'COLD' },
        { name: 'Bebidas',       kds: 'BAR' },
        { name: 'Vinos',         kds: 'BAR' },
        { name: 'Guarniciones',  kds: 'GRILL' },
    ];
    const catMap = new Map<string, number>();
    for (const c of categoriesData) {
        const cat = await findOrCreate(
            () => prisma.category.findFirst({ where: { tenantId: T, name: c.name } }),
            () =>
                prisma.category.create({
                    data: { tenantId: T, name: c.name, kdsStationId: kdsMap.get(c.kds) ?? null },
                }),
        );
        catMap.set(c.name, cat.id);
    }

    // --- Ingredients ---
    const ingredientsData = [
        { name: 'Bife de Chorizo 400g',  unit: 'u',    cost: 8.00,  stock: 40 },
        { name: 'Ojo de Bife 350g',      unit: 'u',    cost: 9.50,  stock: 30 },
        { name: 'Entraña 300g',          unit: 'u',    cost: 7.00,  stock: 25 },
        { name: 'Chorizo Criollo',       unit: 'u',    cost: 1.50,  stock: 60 },
        { name: 'Morcilla',              unit: 'u',    cost: 1.20,  stock: 40 },
        { name: 'Provoleta 200g',        unit: 'u',    cost: 2.80,  stock: 30 },
        { name: 'Lechuga',               unit: 'u',    cost: 0.80,  stock: 50 },
        { name: 'Tomate',                unit: 'kg',   cost: 1.50,  stock: 20 },
        { name: 'Papas',                 unit: 'kg',   cost: 1.00,  stock: 50 },
        { name: 'Vino Malbec (botella)', unit: 'u',    cost: 6.00,  stock: 80 },
        { name: 'Cerveza Artesanal',     unit: 'u',    cost: 1.80,  stock: 120 },
        { name: 'Agua Mineral 500ml',    unit: 'u',    cost: 0.40,  stock: 200 },
        { name: 'Flan Casero',           unit: 'u',    cost: 1.50,  stock: 20 },
        { name: 'Dulce de Leche',        unit: 'kg',   cost: 4.00,  stock: 5 },
    ];
    const ingMap = new Map<string, number>();
    for (const ing of ingredientsData) {
        const dbIng = await findOrCreate(
            () => prisma.ingredient.findFirst({ where: { tenantId: T, name: ing.name } }),
            () =>
                prisma.ingredient.create({
                    data: { tenantId: T, name: ing.name, unit: ing.unit, cost: ing.cost, stock: ing.stock },
                }),
        );
        ingMap.set(ing.name, dbIng.id);

        // Ensure initial stock movement exists
        const hasMov = await prisma.stockMovement.findFirst({ where: { tenantId: T, ingredientId: dbIng.id } });
        if (!hasMov) {
            await prisma.stockMovement.create({
                data: { tenantId: T, ingredientId: dbIng.id, type: 'PURCHASE', quantity: ing.stock },
            });
        }
    }

    // --- Products with recipes ---
    type ProductDef = { name: string; price: number; cat: string; recipe?: { ing: string; qty: number }[] };
    const productsData: ProductDef[] = [
        {
            name: 'Bife de Chorizo',
            price: 28.00,
            cat: 'Parrilla',
            recipe: [{ ing: 'Bife de Chorizo 400g', qty: 1 }],
        },
        {
            name: 'Ojo de Bife',
            price: 32.00,
            cat: 'Parrilla',
            recipe: [{ ing: 'Ojo de Bife 350g', qty: 1 }],
        },
        {
            name: 'Entraña',
            price: 24.00,
            cat: 'Parrilla',
            recipe: [{ ing: 'Entraña 300g', qty: 1 }],
        },
        {
            name: 'Chorizo Criollo',
            price: 6.00,
            cat: 'Achuras',
            recipe: [{ ing: 'Chorizo Criollo', qty: 1 }],
        },
        {
            name: 'Morcilla',
            price: 5.50,
            cat: 'Achuras',
            recipe: [{ ing: 'Morcilla', qty: 1 }],
        },
        {
            name: 'Provoleta',
            price: 10.00,
            cat: 'Entradas',
            recipe: [{ ing: 'Provoleta 200g', qty: 1 }],
        },
        {
            name: 'Ensalada Mixta',
            price: 7.00,
            cat: 'Ensaladas',
            recipe: [
                { ing: 'Lechuga', qty: 0.5 },
                { ing: 'Tomate', qty: 0.2 },
            ],
        },
        {
            name: 'Papas Fritas',
            price: 6.00,
            cat: 'Guarniciones',
            recipe: [{ ing: 'Papas', qty: 0.5 }],
        },
        {
            name: 'Papas a la Provenzal',
            price: 7.50,
            cat: 'Guarniciones',
            recipe: [{ ing: 'Papas', qty: 0.5 }],
        },
        {
            name: 'Flan con Dulce de Leche',
            price: 8.00,
            cat: 'Postres',
            recipe: [
                { ing: 'Flan Casero', qty: 1 },
                { ing: 'Dulce de Leche', qty: 0.05 },
            ],
        },
        {
            name: 'Malbec Alamos',
            price: 18.00,
            cat: 'Vinos',
            recipe: [{ ing: 'Vino Malbec (botella)', qty: 1 }],
        },
        {
            name: 'Cerveza Artesanal IPA',
            price: 6.00,
            cat: 'Bebidas',
            recipe: [{ ing: 'Cerveza Artesanal', qty: 1 }],
        },
        {
            name: 'Agua Mineral',
            price: 3.00,
            cat: 'Bebidas',
            recipe: [{ ing: 'Agua Mineral 500ml', qty: 1 }],
        },
    ];

    const productMap = new Map<string, number>();
    for (const p of productsData) {
        const product = await findOrCreate(
            () => prisma.product.findFirst({ where: { tenantId: T, name: p.name } }),
            () =>
                prisma.product.create({
                    data: {
                        tenantId: T,
                        name: p.name,
                        price: p.price,
                        categoryId: catMap.get(p.cat)!,
                        productType: 'SIMPLE',
                        isStockable: true,
                    },
                }),
        );
        productMap.set(p.name, product.id);

        if (p.recipe) {
            for (const r of p.recipe) {
                const ingredientId = ingMap.get(r.ing);
                if (!ingredientId) continue;
                const exists = await prisma.productIngredient.findFirst({
                    where: { productId: product.id, ingredientId },
                });
                if (!exists) {
                    await prisma.productIngredient.create({
                        data: { tenantId: T, productId: product.id, ingredientId, quantity: r.qty },
                    });
                }
            }
        }
    }

    // --- Modifier groups ---
    const modGroups = [
        {
            name: 'Punto de Cocción',
            min: 1,
            max: 1,
            options: [
                { name: 'Vuelta y Vuelta', price: 0 },
                { name: 'Jugoso', price: 0 },
                { name: 'A Punto', price: 0 },
                { name: 'Cocido', price: 0 },
            ],
        },
        {
            name: 'Guarnición',
            min: 1,
            max: 1,
            options: [
                { name: 'Papas Fritas', price: 0 },
                { name: 'Ensalada', price: 0 },
                { name: 'Papas Provenzal', price: 1.50 },
                { name: 'Puré', price: 0 },
            ],
        },
        {
            name: 'Extras Parrilla',
            min: 0,
            max: 2,
            options: [
                { name: 'Huevo Frito', price: 2.00 },
                { name: 'Salsa Chimichurri', price: 0 },
                { name: 'Salsa Criolla', price: 0 },
            ],
        },
    ];

    const modGroupMap = new Map<string, { id: number }>();
    for (const g of modGroups) {
        const group = await findOrCreate(
            () => prisma.modifierGroup.findFirst({ where: { tenantId: T, name: g.name } }),
            () =>
                prisma.modifierGroup.create({
                    data: {
                        tenantId: T,
                        name: g.name,
                        minSelection: g.min,
                        maxSelection: g.max,
                        options: {
                            create: g.options.map((o) => ({
                                tenantId: T,
                                name: o.name,
                                priceOverlay: o.price,
                            })),
                        },
                    },
                }),
        );
        modGroupMap.set(g.name, group);
    }

    // Link modifiers to grill products
    const grillProducts = ['Bife de Chorizo', 'Ojo de Bife', 'Entraña'];
    for (const pName of grillProducts) {
        const pId = productMap.get(pName);
        if (!pId) continue;
        for (const gName of ['Punto de Cocción', 'Guarnición', 'Extras Parrilla']) {
            const gId = modGroupMap.get(gName)?.id;
            if (!gId) continue;
            await prisma.productModifierGroup.createMany({
                data: [{ tenantId: T, productId: pId, modifierGroupId: gId }],
                skipDuplicates: true,
            });
        }
    }

    // --- Areas & Tables ---
    const salon = await findOrCreate(
        () => prisma.area.findFirst({ where: { tenantId: T, name: 'Salón' } }),
        () => prisma.area.create({ data: { tenantId: T, name: 'Salón' } }),
    );
    const terraza = await findOrCreate(
        () => prisma.area.findFirst({ where: { tenantId: T, name: 'Terraza' } }),
        () => prisma.area.create({ data: { tenantId: T, name: 'Terraza' } }),
    );

    // Salón: 8 tables in 2 rows
    for (let i = 1; i <= 8; i++) {
        const name = `Mesa ${i}`;
        await findOrCreate(
            () => prisma.table.findFirst({ where: { tenantId: T, name } }),
            () =>
                prisma.table.create({
                    data: {
                        tenantId: T,
                        name,
                        areaId: salon.id,
                        x: ((i - 1) % 4) * 160,
                        y: i <= 4 ? 60 : 220,
                    },
                }),
        );
    }
    // Terraza: 4 tables
    for (let i = 9; i <= 12; i++) {
        const name = `Mesa ${i}`;
        await findOrCreate(
            () => prisma.table.findFirst({ where: { tenantId: T, name } }),
            () =>
                prisma.table.create({
                    data: {
                        tenantId: T,
                        name,
                        areaId: terraza.id,
                        x: (i - 9) * 160,
                        y: 60,
                    },
                }),
        );
    }

    // --- Payment methods (full suite) ---
    const paymentMethods = [
        { code: 'CASH', name: 'Efectivo', icon: 'DollarSign', sortOrder: 1 },
        { code: 'CARD', name: 'Tarjeta', icon: 'CreditCard', sortOrder: 2 },
        { code: 'TRANSFER', name: 'Transferencia', icon: 'ArrowRightLeft', sortOrder: 3 },
        { code: 'QR_INTEGRATED', name: 'QR Mercado Pago', icon: 'QrCode', sortOrder: 4 },
    ];
    for (const pm of paymentMethods) {
        await findOrCreate(
            () => prisma.paymentMethodConfig.findFirst({ where: { tenantId: T, code: pm.code } }),
            () =>
                prisma.paymentMethodConfig.create({
                    data: { tenantId: T, code: pm.code, name: pm.name, icon: pm.icon, isActive: true, sortOrder: pm.sortOrder },
                }),
        );
    }

    // --- Tax rates ---
    const taxes = [
        { name: 'IVA 21%', rate: 21.0, isDefault: true },
        { name: 'IVA 10.5%', rate: 10.5, isDefault: false },
        { name: 'Exento', rate: 0, isDefault: false },
    ];
    for (const tx of taxes) {
        await findOrCreate(
            () => prisma.taxRate.findFirst({ where: { tenantId: T, name: tx.name } }),
            () =>
                prisma.taxRate.create({
                    data: { tenantId: T, name: tx.name, rate: tx.rate, isDefault: tx.isDefault, isActive: true },
                }),
        );
    }

    // --- Delivery platforms ---
    const platforms = [
        { code: 'RAPPI', name: 'Rappi' },
        { code: 'PEDIDOSYA', name: 'PedidosYa' },
    ];
    for (const plat of platforms) {
        await findOrCreate(
            () => prisma.deliveryPlatform.findFirst({ where: { tenantId: T, code: plat.code } }),
            () =>
                prisma.deliveryPlatform.create({
                    data: { tenantId: T, code: plat.code, name: plat.name, isEnabled: true },
                }),
        );
    }

    // --- Clients (loyalty test) ---
    const clients = [
        { name: 'Carlos Mendoza', phone: '1155001001', email: 'carlos@mail.com', points: 320, walletBalance: 15.00 },
        { name: 'Ana Beltrán', phone: '1155002002', email: 'ana@mail.com', points: 85, walletBalance: 0 },
    ];
    for (const cl of clients) {
        await findOrCreate(
            () => prisma.client.findFirst({ where: { tenantId: T, phone: cl.phone } }),
            () =>
                prisma.client.create({
                    data: {
                        tenantId: T,
                        name: cl.name,
                        phone: cl.phone,
                        email: cl.email,
                        points: cl.points,
                        walletBalance: cl.walletBalance,
                    },
                }),
        );
    }

    // --- Sample orders: realistic Friday night snapshot ---
    const ramiro = await prisma.user.findFirst({ where: { tenantId: T, email: 'ramiro@fuego.com' } });
    const vale = await prisma.user.findFirst({ where: { tenantId: T, email: 'vale@fuego.com' } });
    const mesa1 = await prisma.table.findFirst({ where: { tenantId: T, name: 'Mesa 1' } });
    const mesa5 = await prisma.table.findFirst({ where: { tenantId: T, name: 'Mesa 5' } });
    const mesa9 = await prisma.table.findFirst({ where: { tenantId: T, name: 'Mesa 9' } });
    const bife = await prisma.product.findFirst({ where: { tenantId: T, name: 'Bife de Chorizo' } });
    const entr = await prisma.product.findFirst({ where: { tenantId: T, name: 'Entraña' } });
    const provol = await prisma.product.findFirst({ where: { tenantId: T, name: 'Provoleta' } });
    const malbec = await prisma.product.findFirst({ where: { tenantId: T, name: 'Malbec Alamos' } });
    const flan = await prisma.product.findFirst({ where: { tenantId: T, name: 'Flan con Dulce de Leche' } });
    const cerveza = await prisma.product.findFirst({ where: { tenantId: T, name: 'Cerveza Artesanal IPA' } });

    let orderNum = 0;

    // Open shift for Ramiro
    if (ramiro) {
        const shift = await prisma.cashShift.findFirst({ where: { tenantId: T, userId: ramiro.id, endTime: null } });
        if (!shift) {
            await ignoreDuplicate(() => prisma.cashShift.create({
                data: { tenantId: T, userId: ramiro.id, startAmount: 10000, businessDate: today(), startTime: new Date() },
            }));
        }
    }

    // Order 1: Mesa 1 — 2 steaks in preparation (KDS grill station active)
    if (ramiro && mesa1 && bife && provol && malbec) {
        orderNum = 1;
        const sub1 = Number(bife.price) * 2 + Number(provol.price) + Number(malbec.price);
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: orderNum,
                channel: 'POS',
                status: 'IN_PREPARATION',
                paymentStatus: 'PENDING',
                subtotal: sub1,
                total: sub1,
                businessDate: today(),
                tableId: mesa1.id,
                serverId: ramiro.id,
                items: {
                    create: [
                        { tenantId: T, productId: bife.id, quantity: 2, unitPrice: Number(bife.price), status: 'COOKING', notes: 'Uno jugoso, uno a punto' },
                        { tenantId: T, productId: provol.id, quantity: 1, unitPrice: Number(provol.price), status: 'READY' },
                        { tenantId: T, productId: malbec.id, quantity: 1, unitPrice: Number(malbec.price), status: 'SERVED' },
                    ],
                },
            },
        }));
    }

    // Order 2: Mesa 5 — waiting to be confirmed (just entered)
    if (vale && mesa5 && entr && cerveza) {
        orderNum = 2;
        const sub2 = Number(entr.price) + Number(cerveza.price) * 2;
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: orderNum,
                channel: 'POS',
                status: 'CONFIRMED',
                paymentStatus: 'PENDING',
                subtotal: sub2,
                total: sub2,
                businessDate: today(),
                tableId: mesa5.id,
                serverId: vale.id,
                items: {
                    create: [
                        { tenantId: T, productId: entr.id, quantity: 1, unitPrice: Number(entr.price), status: 'PENDING' },
                        { tenantId: T, productId: cerveza.id, quantity: 2, unitPrice: Number(cerveza.price), status: 'PENDING' },
                    ],
                },
            },
        }));
    }

    // Order 3: Mesa 9 (terraza) — ready, waiting for pickup
    if (ramiro && mesa9 && bife && flan) {
        orderNum = 3;
        const sub3 = Number(bife.price) + Number(flan.price);
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: orderNum,
                channel: 'POS',
                status: 'PREPARED',
                paymentStatus: 'PENDING',
                subtotal: sub3,
                total: sub3,
                businessDate: today(),
                tableId: mesa9.id,
                serverId: ramiro.id,
                items: {
                    create: [
                        { tenantId: T, productId: bife.id, quantity: 1, unitPrice: Number(bife.price), status: 'READY' },
                        { tenantId: T, productId: flan.id, quantity: 1, unitPrice: Number(flan.price), status: 'READY' },
                    ],
                },
            },
        }));
    }

    // --- Sequence ---
    const seqKey = sequenceKey(T);
    await findOrCreate(
        () => prisma.orderSequence.findFirst({ where: { tenantId: T, sequenceKey: seqKey } }),
        () => prisma.orderSequence.create({ data: { tenantId: T, sequenceKey: seqKey, currentValue: orderNum || 0 } }),
    );

    console.log('  ✅ Fuego Parrilla ready  (PIN diego: 200100 | lucia: 200200 | ramiro: 200400 | vale: 200500 | negro: 200600)');
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE 3 — Tokyo Express
//
// Who: Kenji, 28. Second-generation Japanese-Argentine who turned his
//      parents' shuttered restaurant into a delivery-only "dark kitchen"
//      specialising in ramen, gyoza, and poke bowls. Zero dine-in.
//      All orders come from Rappi, PedidosYa, Glovo, or his own QR-based
//      pickup system for walk-ins near the counter window.
//
// Style: Data-driven, margin-obsessed, startup energy. He tracks
//        commission rates per platform to the decimal, sets different
//        prices per channel (Rappi markup 30%, PedidosYa 25%), and
//        wants real-time dashboards of delivery times.
//
// Pain points:
//   - Platform commissions are eating his margins — needs per-channel
//     pricing to stay profitable without scaring off customers.
//   - Peak hours (12-14h, 20-22h) cause kitchen bottleneck — KDS
//     needs to show estimated times per ticket.
//   - QR pickup orders sometimes get confused with delivery orders.
//   - Doesn't need table management at all — it's wasted screen space.
//
// What this exercises:
//   - Delivery-centric config (delivery ON, KDS ON, tables OFF-ish)
//   - QR menu enabled
//   - 3 delivery platforms with channel-specific pricing
//   - Self-delivery driver management
//   - No dine-in tables, no areas
//   - Digital-only payments (no cash)
//   - Product channel prices (different price per platform)
//   - Lean ingredient tracking (key items only)
// ═══════════════════════════════════════════════════════════════════════════

async function seedTokyoExpress() {
    console.log('\n🍜 Seeding Profile 3: Tokyo Express...');

    // --- Tenant ---
    const tenant = await prisma.tenant.upsert({
        where: { id: 30 },
        update: {},
        create: { id: 30, name: 'Tokyo Express', code: 'tokyo' },
    });
    const T = tenant.id;

    // --- Config: delivery-first, QR pickup ---
    await prisma.tenantConfig.upsert({
        where: { id: 30 },
        update: {},
        create: {
            id: 30,
            tenantId: T,
            businessName: 'Tokyo Express',
            currencySymbol: '$',
            enableStock: true,
            enableDelivery: true,
            enableKDS: true,
            enableFiscal: false,
            qrMenuEnabled: true,
            qrMenuMode: 'INTERACTIVE',
            qrSelfOrderEnabled: true,
        },
    });

    // --- Roles (lean team: owner + cook + 2 drivers) ---
    const rolesData: { name: string; permissions: Record<string, string[]> }[] = [
        {
            name: 'ADMIN',
            permissions: {
                pos: ['access', 'create', 'read', 'update', 'delete'],
                cash: ['access', 'create', 'read', 'update', 'delete'],
                kds: ['access'],
                delivery: ['access'],
                admin: ['access'],
                orders: ['create', 'read', 'update', 'delete'],
                products: ['create', 'read', 'update', 'delete'],
                users: ['create', 'read', 'update', 'delete'],
                settings: ['read', 'update'],
            },
        },
        {
            name: 'KITCHEN',
            permissions: {
                kds: ['access'],
                orders: ['read', 'update'],
            },
        },
        {
            name: 'DELIVERY',
            permissions: {
                delivery: ['access'],
                orders: ['read', 'update'],
            },
        },
    ];

    const roleMap = new Map<string, number>();
    for (const r of rolesData) {
        const role = await findOrCreate(
            () => prisma.role.findFirst({ where: { tenantId: T, name: r.name } }),
            () => prisma.role.create({ data: { tenantId: T, name: r.name, permissions: r.permissions } }),
        );
        roleMap.set(r.name, role.id);
    }

    // --- Users ---
    const usersData = [
        { name: 'Kenji Tanaka',     email: 'kenji@tokyo.com',   pin: '300100', password: 'kenji2026',  role: 'ADMIN' },
        { name: 'Yuki Matsuda',     email: 'yuki@tokyo.com',    pin: '300200', password: 'yuki2026',   role: 'KITCHEN' },
        { name: 'Nico Peralta',     email: 'nico@tokyo.com',    pin: '300300', password: 'nico2026',   role: 'DELIVERY' },
        { name: 'Sofía Iglesias',   email: 'sofia@tokyo.com',   pin: '300400', password: 'sofia2026',  role: 'DELIVERY' },
    ];

    for (const u of usersData) {
        const pin = await hashPin(u.pin);
        const pwHash = await hashPassword(u.password);
        await findOrCreateUser(T, u.email, {
            name: u.name, passwordHash: pwHash, ...pin, roleId: roleMap.get(u.role)!,
        });
    }

    // --- KDS Stations (single screen) ---
    await findOrCreate(
        () => prisma.kdsStation.findFirst({ where: { tenantId: T, code: 'KITCHEN' } }),
        () => prisma.kdsStation.create({ data: { tenantId: T, name: 'Cocina', code: 'KITCHEN', sortOrder: 1, isDefault: true } }),
    );

    // --- Categories ---
    const cats = ['Ramen', 'Gyoza', 'Poke Bowls', 'Extras', 'Bebidas'] as const;
    const catMap = new Map<string, number>();
    for (const name of cats) {
        const c = await findOrCreate(
            () => prisma.category.findFirst({ where: { tenantId: T, name } }),
            () => prisma.category.create({ data: { tenantId: T, name } }),
        );
        catMap.set(name, c.id);
    }

    // --- Ingredients (lean — only track expensive/perishable) ---
    const ingredientsData = [
        { name: 'Caldo Tonkotsu',    unit: 'litro', cost: 3.00,   stock: 40 },
        { name: 'Fideos Ramen',      unit: 'porción', cost: 0.60, stock: 200 },
        { name: 'Chashu Pork',       unit: 'porción', cost: 2.50, stock: 80 },
        { name: 'Masa Gyoza',        unit: 'u',     cost: 0.10,   stock: 500 },
        { name: 'Relleno Cerdo',     unit: 'porción', cost: 0.80, stock: 150 },
        { name: 'Salmón Fresco',     unit: 'porción', cost: 4.00, stock: 60 },
        { name: 'Arroz Sushi',       unit: 'porción', cost: 0.50, stock: 200 },
        { name: 'Palta',             unit: 'u',     cost: 1.20,   stock: 80 },
    ];
    const ingMap = new Map<string, number>();
    for (const ing of ingredientsData) {
        const dbIng = await findOrCreate(
            () => prisma.ingredient.findFirst({ where: { tenantId: T, name: ing.name } }),
            () => prisma.ingredient.create({ data: { tenantId: T, name: ing.name, unit: ing.unit, cost: ing.cost, stock: ing.stock } }),
        );
        ingMap.set(ing.name, dbIng.id);
        const hasMov = await prisma.stockMovement.findFirst({ where: { tenantId: T, ingredientId: dbIng.id } });
        if (!hasMov) {
            await prisma.stockMovement.create({
                data: { tenantId: T, ingredientId: dbIng.id, type: 'PURCHASE', quantity: ing.stock },
            });
        }
    }

    // --- Products ---
    type ProductDef = { name: string; price: number; cat: string; recipe?: { ing: string; qty: number }[] };
    const productsData: ProductDef[] = [
        {
            name: 'Tonkotsu Ramen',
            price: 14.00,
            cat: 'Ramen',
            recipe: [
                { ing: 'Caldo Tonkotsu', qty: 0.5 },
                { ing: 'Fideos Ramen', qty: 1 },
                { ing: 'Chashu Pork', qty: 1 },
            ],
        },
        {
            name: 'Shoyu Ramen',
            price: 12.00,
            cat: 'Ramen',
            recipe: [
                { ing: 'Caldo Tonkotsu', qty: 0.4 },
                { ing: 'Fideos Ramen', qty: 1 },
            ],
        },
        {
            name: 'Gyoza x6',
            price: 8.00,
            cat: 'Gyoza',
            recipe: [
                { ing: 'Masa Gyoza', qty: 6 },
                { ing: 'Relleno Cerdo', qty: 1 },
            ],
        },
        {
            name: 'Gyoza x12',
            price: 14.00,
            cat: 'Gyoza',
            recipe: [
                { ing: 'Masa Gyoza', qty: 12 },
                { ing: 'Relleno Cerdo', qty: 2 },
            ],
        },
        {
            name: 'Poke Salmón',
            price: 16.00,
            cat: 'Poke Bowls',
            recipe: [
                { ing: 'Salmón Fresco', qty: 1 },
                { ing: 'Arroz Sushi', qty: 1 },
                { ing: 'Palta', qty: 0.5 },
            ],
        },
        {
            name: 'Poke Veggie',
            price: 13.00,
            cat: 'Poke Bowls',
            recipe: [
                { ing: 'Arroz Sushi', qty: 1 },
                { ing: 'Palta', qty: 1 },
            ],
        },
        { name: 'Edamame',           price: 5.00,  cat: 'Extras' },
        { name: 'Kimchi',            price: 4.00,  cat: 'Extras' },
        { name: 'Ramune',            price: 4.50,  cat: 'Bebidas' },
        { name: 'Té Verde Frío',     price: 3.50,  cat: 'Bebidas' },
    ];

    const productMap = new Map<string, number>();
    for (const p of productsData) {
        const product = await findOrCreate(
            () => prisma.product.findFirst({ where: { tenantId: T, name: p.name } }),
            () =>
                prisma.product.create({
                    data: {
                        tenantId: T,
                        name: p.name,
                        price: p.price,
                        categoryId: catMap.get(p.cat)!,
                        productType: 'SIMPLE',
                        isStockable: !!p.recipe,
                    },
                }),
        );
        productMap.set(p.name, product.id);

        if (p.recipe) {
            for (const r of p.recipe) {
                const ingredientId = ingMap.get(r.ing);
                if (!ingredientId) continue;
                const exists = await prisma.productIngredient.findFirst({
                    where: { productId: product.id, ingredientId },
                });
                if (!exists) {
                    await prisma.productIngredient.create({
                        data: { tenantId: T, productId: product.id, ingredientId, quantity: r.qty },
                    });
                }
            }
        }
    }

    // --- Modifier groups ---
    const modGroups = [
        {
            name: 'Nivel de Picante',
            min: 1,
            max: 1,
            options: [
                { name: 'Sin Picante', price: 0 },
                { name: 'Suave', price: 0 },
                { name: 'Medio', price: 0 },
                { name: 'Intenso', price: 0 },
            ],
        },
        {
            name: 'Toppings Ramen',
            min: 0,
            max: 3,
            options: [
                { name: 'Huevo Ajitsuke', price: 2.00 },
                { name: 'Chashu Extra', price: 3.50 },
                { name: 'Nori Extra', price: 1.00 },
                { name: 'Maíz', price: 0.50 },
            ],
        },
        {
            name: 'Proteína Poke',
            min: 1,
            max: 1,
            options: [
                { name: 'Salmón', price: 0 },
                { name: 'Atún', price: 1.50 },
                { name: 'Tofu', price: 0 },
            ],
        },
    ];

    const modGroupMap = new Map<string, { id: number }>();
    for (const g of modGroups) {
        const group = await findOrCreate(
            () => prisma.modifierGroup.findFirst({ where: { tenantId: T, name: g.name } }),
            () =>
                prisma.modifierGroup.create({
                    data: {
                        tenantId: T,
                        name: g.name,
                        minSelection: g.min,
                        maxSelection: g.max,
                        options: {
                            create: g.options.map((o) => ({
                                tenantId: T,
                                name: o.name,
                                priceOverlay: o.price,
                            })),
                        },
                    },
                }),
        );
        modGroupMap.set(g.name, group);
    }

    // Link modifiers
    const ramenProducts = ['Tonkotsu Ramen', 'Shoyu Ramen'];
    for (const pName of ramenProducts) {
        const pId = productMap.get(pName);
        if (!pId) continue;
        for (const gName of ['Nivel de Picante', 'Toppings Ramen']) {
            const gId = modGroupMap.get(gName)?.id;
            if (!gId) continue;
            await prisma.productModifierGroup.createMany({
                data: [{ tenantId: T, productId: pId, modifierGroupId: gId }],
                skipDuplicates: true,
            });
        }
    }
    // Poke protein selector
    for (const pName of ['Poke Salmón', 'Poke Veggie']) {
        const pId = productMap.get(pName);
        const gId = modGroupMap.get('Proteína Poke')?.id;
        if (pId && gId) {
            await prisma.productModifierGroup.createMany({
                data: [{ tenantId: T, productId: pId, modifierGroupId: gId }],
                skipDuplicates: true,
            });
        }
    }

    // --- Payment methods: digital only ---
    const paymentMethods = [
        { code: 'CARD', name: 'Tarjeta', icon: 'CreditCard', sortOrder: 1 },
        { code: 'TRANSFER', name: 'Transferencia', icon: 'ArrowRightLeft', sortOrder: 2 },
        { code: 'QR_INTEGRATED', name: 'Mercado Pago', icon: 'QrCode', sortOrder: 3 },
        { code: 'ONLINE', name: 'Pago en App', icon: 'Smartphone', sortOrder: 4 },
    ];
    for (const pm of paymentMethods) {
        await findOrCreate(
            () => prisma.paymentMethodConfig.findFirst({ where: { tenantId: T, code: pm.code } }),
            () =>
                prisma.paymentMethodConfig.create({
                    data: { tenantId: T, code: pm.code, name: pm.name, icon: pm.icon, isActive: true, sortOrder: pm.sortOrder },
                }),
        );
    }

    // --- Delivery platforms with channel pricing ---
    const platforms = [
        { code: 'RAPPI', name: 'Rappi' },
        { code: 'PEDIDOSYA', name: 'PedidosYa' },
        { code: 'GLOVO', name: 'Glovo' },
    ];
    const platMap = new Map<string, number>();
    for (const plat of platforms) {
        const dp = await findOrCreate(
            () => prisma.deliveryPlatform.findFirst({ where: { tenantId: T, code: plat.code } }),
            () => prisma.deliveryPlatform.create({ data: { tenantId: T, code: plat.code, name: plat.name, isEnabled: true } }),
        );
        platMap.set(plat.code, dp.id);
    }

    // Channel-specific pricing: Rappi +30%, PedidosYa +25%, Glovo +20%
    const channelMarkups: Record<string, number> = { RAPPI: 1.30, PEDIDOSYA: 1.25, GLOVO: 1.20 };
    const channelPricedProducts = ['Tonkotsu Ramen', 'Shoyu Ramen', 'Gyoza x6', 'Gyoza x12', 'Poke Salmón', 'Poke Veggie'];

    for (const pName of channelPricedProducts) {
        const pId = productMap.get(pName);
        const baseProduct = await prisma.product.findFirst({ where: { tenantId: T, name: pName } });
        if (!pId || !baseProduct) continue;

        for (const [code, markup] of Object.entries(channelMarkups)) {
            const dpId = platMap.get(code);
            if (!dpId) continue;
            const channelPrice = Math.round(Number(baseProduct.price) * markup * 100) / 100;
            await findOrCreate(
                () => prisma.productChannelPrice.findFirst({ where: { productId: pId, deliveryPlatformId: dpId } }),
                () =>
                    prisma.productChannelPrice.create({
                        data: { tenantId: T, productId: pId, deliveryPlatformId: dpId, price: channelPrice, isAvailable: true },
                    }),
            );
        }
    }

    // --- Self-delivery drivers ---
    const drivers = [
        { name: 'Nico Peralta', phone: '1166001001', vehicleType: 'MOTORCYCLE' as const },
        { name: 'Sofía Iglesias', phone: '1166002002', vehicleType: 'BICYCLE' as const },
    ];
    for (const d of drivers) {
        await findOrCreate(
            () => prisma.deliveryDriver.findFirst({ where: { tenantId: T, phone: d.phone } }),
            () =>
                prisma.deliveryDriver.create({
                    data: { tenantId: T, name: d.name, phone: d.phone, vehicleType: d.vehicleType, isActive: true, isAvailable: true },
                }),
        );
    }

    // --- Sample orders: mixed delivery + QR pickup ---
    const kenji = await prisma.user.findFirst({ where: { tenantId: T, email: 'kenji@tokyo.com' } });
    const tonkotsu = await prisma.product.findFirst({ where: { tenantId: T, name: 'Tonkotsu Ramen' } });
    const gyoza6 = await prisma.product.findFirst({ where: { tenantId: T, name: 'Gyoza x6' } });
    const pokeSalmon = await prisma.product.findFirst({ where: { tenantId: T, name: 'Poke Salmón' } });
    const ramune = await prisma.product.findFirst({ where: { tenantId: T, name: 'Ramune' } });
    const rappiPlatform = await prisma.deliveryPlatform.findFirst({ where: { tenantId: T, code: 'RAPPI' } });

    let orderNum = 0;

    // Open shift for Kenji
    if (kenji) {
        const shift = await prisma.cashShift.findFirst({ where: { tenantId: T, userId: kenji.id, endTime: null } });
        if (!shift) {
            await ignoreDuplicate(() => prisma.cashShift.create({
                data: { tenantId: T, userId: kenji.id, startAmount: 0, businessDate: today(), startTime: new Date() },
            }));
        }
    }

    // Order 1: Rappi delivery — cooking
    if (kenji && tonkotsu && gyoza6 && rappiPlatform) {
        orderNum = 1;
        const sub1 = Number(tonkotsu.price) * 1.30 + Number(gyoza6.price) * 1.30; // Rappi markup
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: orderNum,
                channel: 'DELIVERY_APP',
                status: 'IN_PREPARATION',
                paymentStatus: 'PAID',
                fulfillmentType: 'PLATFORM_DELIVERY',
                deliveryPlatformId: rappiPlatform.id,
                subtotal: sub1,
                total: sub1,
                deliveryFee: 2.50,
                platformCommission: sub1 * 0.25,
                businessDate: today(),
                serverId: kenji.id,
                items: {
                    create: [
                        { tenantId: T, productId: tonkotsu.id, quantity: 1, unitPrice: Number(tonkotsu.price) * 1.30, status: 'COOKING' },
                        { tenantId: T, productId: gyoza6.id, quantity: 1, unitPrice: Number(gyoza6.price) * 1.30, status: 'COOKING' },
                    ],
                },
            },
        }));
    }

    // Order 2: QR pickup — confirmed, waiting for prep
    if (kenji && pokeSalmon && ramune) {
        orderNum = 2;
        const sub2 = Number(pokeSalmon.price) + Number(ramune.price);
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: orderNum,
                channel: 'QR_MENU',
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                fulfillmentType: 'TAKEAWAY',
                subtotal: sub2,
                total: sub2,
                businessDate: today(),
                serverId: kenji.id,
                items: {
                    create: [
                        { tenantId: T, productId: pokeSalmon.id, quantity: 1, unitPrice: Number(pokeSalmon.price), status: 'PENDING' },
                        { tenantId: T, productId: ramune.id, quantity: 1, unitPrice: Number(ramune.price), status: 'PENDING' },
                    ],
                },
            },
        }));
    }

    // Order 3: Self-delivery, on route
    const nicoDriver = await prisma.deliveryDriver.findFirst({ where: { tenantId: T, name: 'Nico Peralta' } });
    const shoyuRamen = await prisma.product.findFirst({ where: { tenantId: T, name: 'Shoyu Ramen' } });
    if (kenji && shoyuRamen && gyoza6 && nicoDriver) {
        orderNum = 3;
        const sub3 = Number(shoyuRamen.price) * 2 + Number(gyoza6.price);
        await ignoreDuplicate(() => prisma.order.create({
            data: {
                tenantId: T,
                orderNumber: orderNum,
                channel: 'DELIVERY_APP',
                status: 'ON_ROUTE',
                paymentStatus: 'PAID',
                fulfillmentType: 'SELF_DELIVERY',
                deliveryDriverId: nicoDriver.id,
                deliveryFee: 3.00,
                subtotal: sub3,
                total: sub3 + 3.00,
                businessDate: today(),
                serverId: kenji.id,
                items: {
                    create: [
                        { tenantId: T, productId: shoyuRamen.id, quantity: 2, unitPrice: Number(shoyuRamen.price), status: 'READY' },
                        { tenantId: T, productId: gyoza6.id, quantity: 1, unitPrice: Number(gyoza6.price), status: 'READY' },
                    ],
                },
            },
        }));
    }

    // --- QR Code for pickup window ---
    await findOrCreate(
        () => prisma.qrCode.findFirst({ where: { tenantId: T, code: 'TKYO-PICKUP' } }),
        () => prisma.qrCode.create({ data: { tenantId: T, code: 'TKYO-PICKUP', isActive: true } }),
    );

    // --- Sequence ---
    const seqKey = sequenceKey(T);
    await findOrCreate(
        () => prisma.orderSequence.findFirst({ where: { tenantId: T, sequenceKey: seqKey } }),
        () => prisma.orderSequence.create({ data: { tenantId: T, sequenceKey: seqKey, currentValue: orderNum || 0 } }),
    );

    console.log('  ✅ Tokyo Express ready  (PIN kenji: 300100 | yuki: 300200 | nico: 300300 | sofia: 300400)');
}

// ═══════════════════════════════════════════════════════════════════════════
// Ensure every tenant has at least one ADMIN user
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_ADMIN_PIN = '999999';
const DEFAULT_ADMIN_PASSWORD = 'Admin2026!';

async function ensureAdminPerTenant() {
    const tenants = await prisma.tenant.findMany({ where: { activeSubscription: true } });
    const results: { tenantId: number; tenant: string; code: string }[] = [];

    const pin = await hashPin(DEFAULT_ADMIN_PIN);
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

    for (const tenant of tenants) {
        // Ensure ADMIN role exists
        const adminRole = await findOrCreate(
            () => prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'ADMIN' } }),
            () => prisma.role.create({ data: { tenantId: tenant.id, name: 'ADMIN', permissions: { all: true } } }),
        );

        // Create or update default admin user on every tenant
        const email = `admin@${tenant.code}.local`;
        await findOrCreateUser(tenant.id, email, {
            name: 'Admin',
            passwordHash,
            ...pin,
            roleId: adminRole.id,
        });

        results.push({ tenantId: tenant.id, tenant: tenant.name, code: tenant.code });
    }

    console.log(`  + Default admin ensured on ${results.length} tenants (PIN: ${DEFAULT_ADMIN_PIN})`);
    return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  PentiumPOS — 3 Business Profile Seed');
    console.log('═══════════════════════════════════════════════════════════');

    await seedLaEsquinaCafe();
    await seedFuegoParrilla();
    await seedTokyoExpress();

    // --- Ensure every tenant has at least one ADMIN user (PIN 999999) ---
    const admins = await ensureAdminPerTenant();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  All profiles seeded. Quick reference:');
    console.log('');
    console.log('  ☕ La Esquina Café   code: esquina   PIN: 100100 (marta)');
    console.log('  🔥 Fuego Parrilla    code: fuego     PIN: 200100 (diego)');
    console.log('  🍜 Tokyo Express     code: tokyo     PIN: 300100 (kenji)');
    if (admins.length > 0) {
        console.log('');
        console.log('  Default admin created for:');
        for (const a of admins) {
            console.log(`    - ${a.tenant} (id ${a.tenantId})  PIN: 999999  email: admin@${a.code}.local`);
        }
    }
    console.log('═══════════════════════════════════════════════════════════');
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
