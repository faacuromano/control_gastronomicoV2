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
    getTable(id: number): Promise<{
        orders: ({
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
}
export declare const tableService: TableService;
//# sourceMappingURL=table.service.d.ts.map