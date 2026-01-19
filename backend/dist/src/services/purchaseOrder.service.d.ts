import { Prisma, PurchaseStatus } from '@prisma/client';
interface CreatePurchaseOrderInput {
    supplierId: number;
    notes?: string;
    items: {
        ingredientId: number;
        quantity: number;
        unitCost: number;
    }[];
}
export declare class PurchaseOrderService {
    /**
     * Get all purchase orders with supplier info
     */
    getAll(status?: PurchaseStatus): Promise<({
        supplier: {
            name: string;
            id: number;
        };
        _count: {
            items: number;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        subtotal: Prisma.Decimal;
        total: Prisma.Decimal;
        orderedAt: Date;
        receivedAt: Date | null;
        supplierId: number;
    })[]>;
    /**
     * Get purchase order by ID with all details
     */
    getById(id: number): Promise<{
        supplier: {
            name: string;
            id: number;
            email: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
        };
        items: ({
            ingredient: {
                name: string;
                id: number;
                unit: string;
            };
        } & {
            id: number;
            ingredientId: number;
            quantity: Prisma.Decimal;
            unitCost: Prisma.Decimal;
            purchaseOrderId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        subtotal: Prisma.Decimal;
        total: Prisma.Decimal;
        orderedAt: Date;
        receivedAt: Date | null;
        supplierId: number;
    }>;
    /**
     * Generate next order number
     */
    private getNextOrderNumber;
    /**
     * Create a new purchase order
     */
    create(data: CreatePurchaseOrderInput): Promise<{
        supplier: {
            name: string;
            id: number;
            email: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
        };
        items: ({
            ingredient: {
                name: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                unit: string;
                cost: Prisma.Decimal;
                stock: Prisma.Decimal;
                minStock: Prisma.Decimal;
            };
        } & {
            id: number;
            ingredientId: number;
            quantity: Prisma.Decimal;
            unitCost: Prisma.Decimal;
            purchaseOrderId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        subtotal: Prisma.Decimal;
        total: Prisma.Decimal;
        orderedAt: Date;
        receivedAt: Date | null;
        supplierId: number;
    }>;
    /**
     * Update purchase order status
     */
    updateStatus(id: number, status: PurchaseStatus): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        subtotal: Prisma.Decimal;
        total: Prisma.Decimal;
        orderedAt: Date;
        receivedAt: Date | null;
        supplierId: number;
    }>;
    /**
     * Receive purchase order - updates stock
     */
    receivePurchaseOrder(id: number): Promise<{
        supplier: {
            name: string;
            id: number;
            email: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
        };
        items: ({
            ingredient: {
                name: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                unit: string;
                cost: Prisma.Decimal;
                stock: Prisma.Decimal;
                minStock: Prisma.Decimal;
            };
        } & {
            id: number;
            ingredientId: number;
            quantity: Prisma.Decimal;
            unitCost: Prisma.Decimal;
            purchaseOrderId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        subtotal: Prisma.Decimal;
        total: Prisma.Decimal;
        orderedAt: Date;
        receivedAt: Date | null;
        supplierId: number;
    }>;
    /**
     * Cancel purchase order
     */
    cancel(id: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        status: import(".prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        subtotal: Prisma.Decimal;
        total: Prisma.Decimal;
        orderedAt: Date;
        receivedAt: Date | null;
        supplierId: number;
    }>;
    /**
     * Delete purchase order (only if PENDING)
     */
    delete(id: number): Promise<void>;
}
export declare const purchaseOrderService: PurchaseOrderService;
export {};
//# sourceMappingURL=purchaseOrder.service.d.ts.map