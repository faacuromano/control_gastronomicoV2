/**
 * @fileoverview Order-related type definitions.
 * 
 * @module types/order.types
 * @extracted_from order.service.ts (Phase 2 Refactoring)
 */

import { OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

// ============================================
// INPUT TYPES (External API contracts)
// ============================================

/**
 * Input for a single order item.
 */
export interface OrderItemInput {
    productId: number;
    quantity: number;
    notes?: string | undefined;
    modifiers?: { id: number; price: number }[] | undefined;
    removedIngredientIds?: number[] | undefined;
}

/**
 * Input for delivery details.
 */
export interface DeliveryData {
    address: string;
    notes?: string | undefined;
    phone: string;
    name: string;
    driverId?: number | undefined;
}

/**
 * Input for creating a new order.
 * Supports both legacy single payment and split payments.
 */
export interface CreateOrderInput {
    tenantId?: number; // Optional for migration/compatibility
    userId: number;
    items: OrderItemInput[];
    channel?: OrderChannel | undefined;
    tableId?: number | undefined;
    clientId?: number | undefined;
    serverId?: number | undefined;
    deliveryData?: DeliveryData | undefined;
    paymentMethod?: PaymentMethod | 'SPLIT' | undefined;
    payments?: { method: string; amount: number }[] | undefined;
    discount?: number | undefined; // Manual discount amount applied at checkout
}

// ============================================
// INTERNAL TYPES (Service implementation)
// ============================================

/**
 * Internal structure for order item data before insertion.
 */
export interface OrderItemData {
    productId: number;
    quantity: number;
    unitPrice: number;
    notes?: string | undefined;
    status: string;
    modifiers?: { id: number; price: number }[] | undefined;
}

/**
 * Internal structure for stock updates.
 */
export interface StockUpdate {
    ingredientId: number;
    quantity: number;
}

/**
 * Result from validateAndCalculateItems.
 */
export interface ItemCalculationResult {
    itemDataList: OrderItemData[];
    stockUpdates: StockUpdate[];
    subtotal: number;
}

/**
 * Prisma order creation data structure.
 */
export interface OrderCreateData {
    tenantId: number;
    orderNumber: number;
    channel: OrderChannel;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    subtotal: number;
    total: number;
    businessDate: Date;
    tableId?: number;
    clientId?: number;
    serverId?: number;
    driverId?: number;
    deliveryAddress?: string;
    deliveryNotes?: string;
    closedAt?: Date;
    items: {
        create: {
            tenantId: number;
            product: { connect: { id: number } };
            quantity: number;
            unitPrice: number;
            notes: string | null;
            status: string;
            modifiers?: {
                create: { tenantId: number; modifierOptionId: number; priceCharged: number }[]
            };
        }[];
    };
    payments?: {
        create: {
            tenantId: number;
            amount: number;
            method: PaymentMethod;
            shiftId: number;
        }[];
    };
}

/**
 * Data structure for updating order status.
 */
export interface OrderUpdateData {
    status: OrderStatus;
    closedAt?: Date;
}

// ============================================
// PAYMENT TYPES (Add Payments to Order)
// ============================================

/**
 * Input for adding a single payment to an existing order.
 *
 * @interface PaymentInput
 * @property {string} method - Payment method code (e.g., 'CASH', 'CARD', 'TRANSFER')
 * @property {number} amount - Payment amount (must be positive, non-zero)
 */
export interface AddPaymentInput {
    method: string;
    amount: number;
}

/**
 * Request body for POST /orders/:id/payments endpoint.
 *
 * @interface AddPaymentsRequest
 * @property {AddPaymentInput[]} payments - Array of payments to add
 * @property {boolean} [closeOrder] - If true and order is fully paid, auto-close the order
 */
export interface AddPaymentsRequest {
    payments: AddPaymentInput[];
    closeOrder?: boolean;
}

/**
 * Result of adding payments to an order.
 *
 * @interface AddPaymentsResult
 */
export interface AddPaymentsResult {
    /** Updated order ID */
    orderId: number;
    /** Order total amount */
    orderTotal: number;
    /** Total amount paid before this operation */
    previouslyPaid: number;
    /** Amount added in this operation */
    amountAdded: number;
    /** Total amount paid after this operation */
    totalPaid: number;
    /** Remaining balance (negative if overpaid) */
    remainingBalance: number;
    /** Updated payment status */
    paymentStatus: PaymentStatus;
    /** Whether order was closed by this operation */
    orderClosed: boolean;
    /** IDs of created payment records */
    paymentIds: number[];
}
