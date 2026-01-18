import { Prisma } from '@prisma/client';
export declare class SupplierService {
    /**
     * Get all active suppliers
     */
    getAll(): Promise<{
        name: string;
        id: number;
        email: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        taxId: string | null;
    }[]>;
    /**
     * Get supplier by ID
     */
    getById(id: number): Promise<{
        name: string;
        id: number;
        email: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        taxId: string | null;
    }>;
    /**
     * Create new supplier
     */
    create(data: Prisma.SupplierCreateInput): Promise<{
        name: string;
        id: number;
        email: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        taxId: string | null;
    }>;
    /**
     * Update supplier
     */
    update(id: number, data: Prisma.SupplierUpdateInput): Promise<{
        name: string;
        id: number;
        email: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        taxId: string | null;
    }>;
    /**
     * Soft delete supplier
     * Validates that supplier has no purchase orders
     */
    delete(id: number): Promise<{
        name: string;
        id: number;
        email: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        taxId: string | null;
    }>;
}
export declare const supplierService: SupplierService;
//# sourceMappingURL=supplier.service.d.ts.map