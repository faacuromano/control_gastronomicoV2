/**
 * @fileoverview Order-related type definitions.
 *
 * @module types/order.types
 * @extracted_from order.service.ts (Phase 2 Refactoring)
 */
import { OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
/**
 * Input for a single order item.
 */
export interface OrderItemInput {
    productId: number;
    quantity: number;
    notes?: string | undefined;
    modifiers?: {
        id: number;
        price: number;
    }[] | undefined;
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
    userId: number;
    items: OrderItemInput[];
    channel?: OrderChannel | undefined;
    tableId?: number | undefined;
    clientId?: number | undefined;
    serverId?: number | undefined;
    deliveryData?: DeliveryData | undefined;
    paymentMethod?: PaymentMethod | 'SPLIT' | undefined;
    payments?: {
        method: string;
        amount: number;
    }[] | undefined;
}
/**
 * Internal structure for order item data before insertion.
 */
export interface OrderItemData {
    productId: number;
    quantity: number;
    unitPrice: number;
    notes?: string | undefined;
    status: string;
    modifiers?: {
        id: number;
        price: number;
    }[] | undefined;
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
            product: {
                connect: {
                    id: number;
                };
            };
            quantity: number;
            unitPrice: number;
            notes: string | null;
            status: string;
            modifiers?: {
                create: {
                    modifierOptionId: number;
                    priceCharged: number;
                }[];
            };
        }[];
    };
    payments?: {
        create: {
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
//# sourceMappingURL=order.types.d.ts.map