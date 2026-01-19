interface GenerateInvoiceData {
    orderId: number;
    type?: 'RECEIPT' | 'INVOICE_B' | undefined;
    clientName?: string | undefined;
    clientTaxId?: string | undefined;
}
/**
 * Generate invoice for an order
 */
export declare function generateInvoice(data: GenerateInvoiceData): Promise<{
    order: {
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
            orderId: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            notes: string | null;
        })[];
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            tip: import("@prisma/client/runtime/library").Decimal;
            orderId: number;
            amount: import("@prisma/client/runtime/library").Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
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
    type: import(".prisma/client").$Enums.InvoiceType;
    createdAt: Date;
    subtotal: import("@prisma/client/runtime/library").Decimal;
    total: import("@prisma/client/runtime/library").Decimal;
    orderId: number;
    invoiceNumber: string;
    clientName: string | null;
    clientTaxId: string | null;
    tax: import("@prisma/client/runtime/library").Decimal;
}>;
/**
 * Get invoice by order ID
 */
export declare function getByOrderId(orderId: number): Promise<{
    order: {
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
            orderId: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            notes: string | null;
        })[];
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            tip: import("@prisma/client/runtime/library").Decimal;
            orderId: number;
            amount: import("@prisma/client/runtime/library").Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
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
    type: import(".prisma/client").$Enums.InvoiceType;
    createdAt: Date;
    subtotal: import("@prisma/client/runtime/library").Decimal;
    total: import("@prisma/client/runtime/library").Decimal;
    orderId: number;
    invoiceNumber: string;
    clientName: string | null;
    clientTaxId: string | null;
    tax: import("@prisma/client/runtime/library").Decimal;
}>;
/**
 * Get invoice by invoice number
 */
export declare function getByInvoiceNumber(invoiceNumber: string): Promise<{
    order: {
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
            orderId: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            notes: string | null;
        })[];
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            tip: import("@prisma/client/runtime/library").Decimal;
            orderId: number;
            amount: import("@prisma/client/runtime/library").Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
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
    type: import(".prisma/client").$Enums.InvoiceType;
    createdAt: Date;
    subtotal: import("@prisma/client/runtime/library").Decimal;
    total: import("@prisma/client/runtime/library").Decimal;
    orderId: number;
    invoiceNumber: string;
    clientName: string | null;
    clientTaxId: string | null;
    tax: import("@prisma/client/runtime/library").Decimal;
}>;
interface GetAllFilters {
    type?: 'RECEIPT' | 'INVOICE_B';
    startDate?: Date;
    endDate?: Date;
}
/**
 * Get all invoices with optional filters
 */
export declare function getAll(filters?: GetAllFilters): Promise<({
    order: {
        client: {
            name: string;
        } | null;
        orderNumber: number;
        total: import("@prisma/client/runtime/library").Decimal;
    };
} & {
    id: number;
    type: import(".prisma/client").$Enums.InvoiceType;
    createdAt: Date;
    subtotal: import("@prisma/client/runtime/library").Decimal;
    total: import("@prisma/client/runtime/library").Decimal;
    orderId: number;
    invoiceNumber: string;
    clientName: string | null;
    clientTaxId: string | null;
    tax: import("@prisma/client/runtime/library").Decimal;
})[]>;
export {};
//# sourceMappingURL=invoice.service.d.ts.map