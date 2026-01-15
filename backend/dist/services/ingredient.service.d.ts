export declare class IngredientService {
    getAll(): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        unit: string;
        cost: import("@prisma/client/runtime/library").Decimal;
        stock: import("@prisma/client/runtime/library").Decimal;
        minStock: import("@prisma/client/runtime/library").Decimal;
    }[]>;
    getById(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        unit: string;
        cost: import("@prisma/client/runtime/library").Decimal;
        stock: import("@prisma/client/runtime/library").Decimal;
        minStock: import("@prisma/client/runtime/library").Decimal;
    } | null>;
    create(data: {
        name: string;
        unit: string;
        cost: number;
        stock: number;
        minStock?: number;
    }): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        unit: string;
        cost: import("@prisma/client/runtime/library").Decimal;
        stock: import("@prisma/client/runtime/library").Decimal;
        minStock: import("@prisma/client/runtime/library").Decimal;
    }>;
    update(id: number, data: {
        name?: string;
        unit?: string;
        cost?: number;
        minStock?: number;
    }): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        unit: string;
        cost: import("@prisma/client/runtime/library").Decimal;
        stock: import("@prisma/client/runtime/library").Decimal;
        minStock: import("@prisma/client/runtime/library").Decimal;
    }>;
    delete(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        unit: string;
        cost: import("@prisma/client/runtime/library").Decimal;
        stock: import("@prisma/client/runtime/library").Decimal;
        minStock: import("@prisma/client/runtime/library").Decimal;
    }>;
}
//# sourceMappingURL=ingredient.service.d.ts.map