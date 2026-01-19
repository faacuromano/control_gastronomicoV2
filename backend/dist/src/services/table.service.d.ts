export declare class TableService {
    getAreas(): Promise<({
        tables: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            y: number | null;
            status: import(".prisma/client").$Enums.TableStatus;
            areaId: number;
            x: number | null;
            currentOrderId: number | null;
        }[];
    } & {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    createArea(data: {
        name: string;
    }): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateArea(id: number, data: {
        name: string;
    }): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteArea(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createTable(data: {
        name: string;
        areaId: number;
        x?: number;
        y?: number;
    }): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    updateTable(id: number, data: {
        name?: string;
        x?: number;
        y?: number;
    }): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    updateTablePosition(id: number, x: number, y: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    updatePositions(updates: {
        id: number;
        x: number;
        y: number;
    }[]): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }[]>;
    getTable(id: number): Promise<{
        orders: ({
            items: {
                id: number;
                quantity: number;
                productId: number;
                status: import(".prisma/client").$Enums.ItemStatus;
                orderId: number;
                unitPrice: import("@prisma/client/runtime/library").Decimal;
                notes: string | null;
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
        })[];
    } & {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    deleteTable(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    openTable(id: number, orderId: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    closeTable(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    assignOrderToTable(tableId: number, orderId: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    freeTableFromOrder(tableId: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        y: number | null;
        status: import(".prisma/client").$Enums.TableStatus;
        areaId: number;
        x: number | null;
        currentOrderId: number | null;
    }>;
    /**
     * Opens a table by creating an empty order and marking table as OCCUPIED
     */
    openTableWithOrder(tableId: number, serverId: number, pax?: number): Promise<{
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
    }>;
    /**
     * Closes a table by processing payment and freeing the table
     */
    closeTableWithPayment(tableId: number, serverId: number, payments: {
        method: string;
        amount: number;
    }[]): Promise<{
        orderId: number;
        total: number;
        paid: number;
        status: import(".prisma/client").$Enums.PaymentStatus;
    }>;
}
export declare const tableService: TableService;
//# sourceMappingURL=table.service.d.ts.map