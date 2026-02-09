/**
 * @fileoverview Mock API for offline-first development and testing.
 * Provides realistic POS data (Spanish) without a running backend.
 * Activated by VITE_OFFLINE_MOCK=true environment variable.
 *
 * @module lib/dummyApi
 */

import type { OfflineProduct, OfflineCategory } from './offlineDb';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_CATEGORIES: OfflineCategory[] = [
    { id: 1, name: 'Hamburguesas' },
    { id: 2, name: 'Bebidas' },
    { id: 3, name: 'Acompañamientos' },
];

const MOCK_PRODUCTS: OfflineProduct[] = [
    {
        id: 1, name: 'Hamburguesa Clásica', price: 2500, categoryId: 1, categoryName: 'Hamburguesas',
        isActive: true, productType: 'SIMPLE',
        modifierGroups: [
            {
                id: 1, name: 'Extras', minSelection: 0, maxSelection: 3,
                options: [
                    { id: 1, name: 'Queso cheddar', price: 300 },
                    { id: 2, name: 'Bacon', price: 500 },
                    { id: 3, name: 'Huevo frito', price: 400 },
                ]
            }
        ]
    },
    {
        id: 2, name: 'Hamburguesa Doble', price: 3800, categoryId: 1, categoryName: 'Hamburguesas',
        isActive: true, productType: 'SIMPLE', modifierGroups: []
    },
    {
        id: 3, name: 'Coca-Cola 500ml', price: 800, categoryId: 2, categoryName: 'Bebidas',
        isActive: true, productType: 'SIMPLE', modifierGroups: []
    },
    {
        id: 4, name: 'Agua Mineral', price: 500, categoryId: 2, categoryName: 'Bebidas',
        isActive: true, productType: 'SIMPLE', modifierGroups: []
    },
    {
        id: 5, name: 'Papas Fritas', price: 1200, categoryId: 3, categoryName: 'Acompañamientos',
        isActive: true, productType: 'SIMPLE', modifierGroups: []
    },
];

// ============================================================================
// STATE
// ============================================================================

let _latencyMs = 200;
let _failureRate = 0;
let _orderCounter = 100;
let _syncToken = `sync_${Date.now()}_mock`;

// ============================================================================
// CONFIGURATION
// ============================================================================

export function setLatency(ms: number) { _latencyMs = ms; }
export function setFailureRate(rate: number) { _failureRate = Math.max(0, Math.min(1, rate)); }

// ============================================================================
// HELPERS
// ============================================================================

async function simulateDelay() {
    if (_latencyMs > 0) {
        await new Promise(r => setTimeout(r, _latencyMs));
    }
}

function shouldFail(): boolean {
    return Math.random() < _failureRate;
}

// ============================================================================
// MOCK API RESPONSES
// ============================================================================

export async function pullData() {
    await simulateDelay();
    if (shouldFail()) throw new Error('Mock: pull failed (simulated)');
    return {
        data: {
            data: {
                products: MOCK_PRODUCTS,
                categories: MOCK_CATEGORIES,
                printerRouting: [],
                serverTime: new Date().toISOString(),
                syncToken: _syncToken,
            }
        }
    };
}

export async function pushData(payload: unknown) {
    await simulateDelay();
    if (shouldFail()) throw new Error('Mock: push failed (simulated)');

    const data = payload as { pendingOrders?: { tempId: string }[]; pendingPayments?: unknown[] };
    const orders = data.pendingOrders || [];

    const orderMappings = orders.map(o => ({
        tempId: o.tempId,
        realId: ++_orderCounter,
        orderNumber: _orderCounter,
        status: 'SYNCED' as const,
    }));

    _syncToken = `sync_${Date.now()}_mock`;

    return {
        data: {
            data: {
                success: true,
                orderMappings,
                errors: [],
                warnings: [],
                syncedAt: new Date().toISOString(),
            }
        }
    };
}

export async function createOrder(payload: unknown) {
    await simulateDelay();
    if (shouldFail()) throw new Error('Mock: createOrder failed (simulated)');

    const data = payload as { items?: { productId: number; quantity: number; notes?: string }[]; channel?: string };
    const items = data.items || [];
    const orderId = ++_orderCounter;

    let total = 0;
    const responseItems = items.map((item, idx) => {
        const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
        const unitPrice = product?.price || 0;
        total += unitPrice * item.quantity;
        return {
            id: orderId * 100 + idx,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: String(unitPrice),
            notes: item.notes || null,
        };
    });

    return {
        data: {
            data: {
                id: orderId,
                orderNumber: orderId,
                channel: data.channel || 'POS',
                status: 'PENDING',
                paymentStatus: 'PENDING',
                subtotal: String(total),
                total: String(total),
                createdAt: new Date().toISOString(),
                items: responseItems,
            }
        }
    };
}

export async function addPayments(orderId: number, _payload: unknown) {
    await simulateDelay();
    if (shouldFail()) throw new Error('Mock: addPayments failed (simulated)');

    return {
        data: {
            data: {
                id: orderId,
                orderNumber: orderId,
                channel: 'POS',
                status: 'CLOSED',
                paymentStatus: 'PAID',
                subtotal: '0',
                total: '0',
                createdAt: new Date().toISOString(),
                items: [],
            }
        }
    };
}
