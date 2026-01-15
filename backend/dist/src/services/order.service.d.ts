import { OrderChannel, PaymentMethod } from '@prisma/client';
export interface OrderItemInput {
    productId: number;
    quantity: number;
    notes?: string;
}
export interface CreateOrderInput {
    items: OrderItemInput[];
    channel?: OrderChannel;
    tableId?: number;
    clientId?: number;
    serverId?: number;
    paymentMethod?: PaymentMethod;
}
export declare class OrderService {
    createOrder(data: CreateOrderInput): Promise<{
        items: {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            notes: string | null;
            orderId: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
    }>;
    getRecentOrders(): Promise<({
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
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            notes: string | null;
            orderId: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
    })[]>;
}
//# sourceMappingURL=order.service.d.ts.map