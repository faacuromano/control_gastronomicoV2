/**
 * @fileoverview Kitchen Display System (KDS) order operations.
 * Handles item status updates and active order queries for kitchen staff.
 *
 * @module services/orderKitchen.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */
/**
 * Service for KDS (Kitchen Display System) operations.
 * Manages order item status updates and kitchen order visibility.
 */
export declare class OrderKitchenService {
    /**
     * Update individual order item status.
     * Broadcasts update to KDS clients via WebSocket.
     */
    updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED'): Promise<{
        order: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            orderNumber: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            clientId: number | null;
            channel: import(".prisma/client").$Enums.OrderChannel;
            externalId: string | null;
            externalPayload: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            discount: import("@prisma/client/runtime/library").Decimal;
            tip: import("@prisma/client/runtime/library").Decimal;
            total: import("@prisma/client/runtime/library").Decimal;
            tableId: number | null;
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
        };
    } & {
        id: number;
        quantity: number;
        productId: number;
        status: import(".prisma/client").$Enums.ItemStatus;
        orderId: number;
        unitPrice: import("@prisma/client/runtime/library").Decimal;
        notes: string | null;
    }>;
    /**
     * Mark all items in an order as SERVED.
     * Used when kitchen finishes a table order and waiter picks it up.
     */
    markAllItemsServed(orderId: number): Promise<({
        client: {
            name: string;
            id: number;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
            points: number;
            walletBalance: import("@prisma/client/runtime/library").Decimal;
        } | null;
        driver: {
            name: string;
            id: number;
            email: string | null;
            pinCode: string | null;
            roleId: number;
            passwordHash: string | null;
            uiSettings: import("@prisma/client/runtime/library").JsonValue | null;
            isActive: boolean;
            failedLoginAttempts: number;
            lockedUntil: Date | null;
            createdAt: Date;
            updatedAt: Date;
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
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            orderId: number;
            tip: import("@prisma/client/runtime/library").Decimal;
            amount: import("@prisma/client/runtime/library").Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        clientId: number | null;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        externalPayload: import("@prisma/client/runtime/library").JsonValue | null;
        peopleCount: number;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        tip: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        tableId: number | null;
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
    }) | null>;
    /**
     * Get active orders for KDS (Kitchen Display System).
     * Returns orders that are not CLOSED, CANCELLED or DELIVERED.
     * Focuses on orders that need kitchen attention.
     */
    getActiveOrders(): Promise<({
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
        status: import(".prisma/client").$Enums.OrderStatus;
        clientId: number | null;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        externalPayload: import("@prisma/client/runtime/library").JsonValue | null;
        peopleCount: number;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        tip: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        tableId: number | null;
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
    })[]>;
    /**
     * Helper to get order with full relations for broadcasting.
     * @private
     */
    private getOrderWithRelations;
}
export declare const orderKitchenService: OrderKitchenService;
//# sourceMappingURL=orderKitchen.service.d.ts.map