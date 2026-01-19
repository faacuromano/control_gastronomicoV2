/**
 * @fileoverview Order status management with state machine validation.
 * Handles order status transitions and enforces valid state changes.
 *
 * @module services/orderStatus.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */
import { OrderStatus } from '@prisma/client';
/**
 * Service for order status transitions.
 * Implements state machine validation to prevent invalid transitions.
 */
export declare class OrderStatusService {
    /**
     * Valid state transitions for order status.
     * Format: { FROM_STATUS: [allowed TO_STATUSES] }
     */
    private readonly allowedTransitions;
    /**
     * Terminal statuses that close the order.
     */
    private readonly terminalStatuses;
    /**
     * Update order status and broadcast to KDS.
     * Includes state machine validation to prevent invalid transitions.
     */
    updateStatus(orderId: number, status: OrderStatus): Promise<{
        table: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            y: number | null;
            status: import(".prisma/client").$Enums.TableStatus;
            areaId: number;
            x: number | null;
            currentOrderId: number | null;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: import("@prisma/client/runtime/library").Decimal;
                    qtyUsed: import("@prisma/client/runtime/library").Decimal | null;
                };
            } & {
                id: number;
                priceCharged: import("@prisma/client/runtime/library").Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        externalPayload: import("@prisma/client/runtime/library").JsonValue | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        tip: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        fulfillmentType: import(".prisma/client").$Enums.FulfillmentType;
        deliveryPlatformId: number | null;
        deliveryDriverId: number | null;
        estimatedDeliveryAt: Date | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal | null;
        platformCommission: import("@prisma/client/runtime/library").Decimal | null;
        closedAt: Date | null;
        businessDate: Date;
    }>;
    /**
     * Check if a status transition is valid.
     */
    isValidTransition(fromStatus: OrderStatus, toStatus: OrderStatus): boolean;
    /**
     * Get allowed next statuses for a given status.
     */
    getAllowedTransitions(currentStatus: OrderStatus): OrderStatus[];
}
export declare const orderStatusService: OrderStatusService;
//# sourceMappingURL=orderStatus.service.d.ts.map