/**
 * @fileoverview Delivery order operations.
 * Handles driver assignment and delivery order queries.
 *
 * @module services/orderDelivery.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */
/**
 * Service for delivery-specific order operations.
 * Manages driver assignments and delivery order visibility.
 */
export declare class OrderDeliveryService {
    /**
     * Assign a driver to an order.
     * Does not change order status - use OrderStatusService for that.
     */
    assignDriver(orderId: number, driverId: number): Promise<{
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
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
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
        closedAt: Date | null;
        businessDate: Date;
    }>;
    /**
     * Get active delivery orders (including delivered orders from today).
     * Used by delivery dashboard to display pending and recent deliveries.
     */
    getDeliveryOrders(): Promise<({
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
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
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
        closedAt: Date | null;
        businessDate: Date;
    })[]>;
}
export declare const orderDeliveryService: OrderDeliveryService;
//# sourceMappingURL=orderDelivery.service.d.ts.map