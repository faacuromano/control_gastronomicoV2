/**
 * @fileoverview Types for offline synchronization system
 * @module types/sync
 */

import { PaymentMethod, OrderStatus, OrderChannel } from '@prisma/client';

// ============================================================================
// PULL TYPES (Server → Client)
// ============================================================================

/**
 * Product data for offline cache
 */
export interface SyncProduct {
    id: number;
    name: string;
    price: number;
    categoryId: number;
    categoryName: string;
    isActive: boolean;
    productType: string;
    modifierGroups: SyncModifierGroup[];
}

/**
 * Modifier group for offline cache
 */
export interface SyncModifierGroup {
    id: number;
    name: string;
    minSelection: number;
    maxSelection: number;
    options: SyncModifierOption[];
}

/**
 * Modifier option for offline cache
 */
export interface SyncModifierOption {
    id: number;
    name: string;
    price: number;
}

/**
 * Category for offline cache
 */
export interface SyncCategory {
    id: number;
    name: string;
}

/**
 * Printer routing cache for offline printing
 */
export interface SyncPrinterRouting {
    categoryId: number;
    printerId: number;
    printerName: string;
    connectionType: string;
    ipAddress: string | null;
    windowsName: string | null;
}

/**
 * Response from /sync/pull endpoint
 */
export interface SyncPullResponse {
    products: SyncProduct[];
    categories: SyncCategory[];
    printerRouting: SyncPrinterRouting[];
    serverTime: string;  // ISO8601
    syncToken: string;   // For future delta sync
}

// ============================================================================
// PUSH TYPES (Client → Server)
// ============================================================================

/**
 * Order item input from offline queue
 */
export interface PendingOrderItem {
    productId: number;
    quantity: number;
    notes?: string;
    modifiers?: { id: number; price: number }[];
    removedIngredientIds?: number[];
}

/**
 * Pending order from offline queue
 */
export interface PendingOrder {
    tempId: string;          // Client-generated temporary ID
    items: PendingOrderItem[];
    channel: OrderChannel;
    tableId?: number;
    clientId?: number;
    createdAt: string;       // ISO8601 when created offline
    shiftId?: number;        // Shift ID at time of creation (may change)
}

/**
 * Pending payment from offline queue
 */
export interface PendingPayment {
    tempOrderId: string;     // Reference to PendingOrder.tempId
    method: PaymentMethod;
    amount: number;
    createdAt: string;       // ISO8601
}

/**
 * Request body for /sync/push endpoint
 */
export interface SyncPushRequest {
    clientId: string;        // Terminal identifier
    pendingOrders: PendingOrder[];
    pendingPayments: PendingPayment[];
}

// ============================================================================
// PUSH RESPONSE TYPES
// ============================================================================

export type SyncOrderStatus = 'SYNCED' | 'CONFLICT' | 'ERROR';

/**
 * Mapping between temp ID and real ID after sync
 */
export interface OrderMapping {
    tempId: string;
    realId: number | null;
    orderNumber: number | null;
    status: SyncOrderStatus;
}

/**
 * Error during sync
 */
export interface SyncError {
    tempId: string;
    code: string;
    message: string;
}

/**
 * Warning during sync (non-fatal)
 */
export interface SyncWarning {
    tempId: string;
    code: string;
    message: string;
}

/**
 * Response from /sync/push endpoint
 */
export interface SyncPushResponse {
    success: boolean;
    orderMappings: OrderMapping[];
    errors: SyncError[];
    warnings: SyncWarning[];
    syncedAt: string;        // ISO8601
}
