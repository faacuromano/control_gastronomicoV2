export interface CreateGroupInput {
    name: string;
    minSelection?: number;
    maxSelection?: number;
}
export interface UpdateGroupInput {
    name?: string;
    minSelection?: number;
    maxSelection?: number;
}
export interface CreateOptionInput {
    name: string;
    priceOverlay?: number;
    ingredientId?: number;
    qtyUsed?: number;
}
export interface UpdateOptionInput {
    name?: string;
    priceOverlay?: number;
    ingredientId?: number;
    qtyUsed?: number;
}
export declare const modifierService: {
    getAllGroups: () => Promise<({
        products: {
            productId: number;
            modifierGroupId: number;
        }[];
        options: ({
            ingredient: {
                name: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                unit: string;
                cost: import("@prisma/client/runtime/library").Decimal;
                stock: import("@prisma/client/runtime/library").Decimal;
                minStock: import("@prisma/client/runtime/library").Decimal;
            } | null;
        } & {
            name: string;
            id: number;
            isActive: boolean;
            ingredientId: number | null;
            modifierGroupId: number;
            priceOverlay: import("@prisma/client/runtime/library").Decimal;
            qtyUsed: import("@prisma/client/runtime/library").Decimal | null;
        })[];
    } & {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        minSelection: number;
        maxSelection: number;
    })[]>;
    getGroupById: (id: number) => Promise<({
        options: ({
            ingredient: {
                name: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                unit: string;
                cost: import("@prisma/client/runtime/library").Decimal;
                stock: import("@prisma/client/runtime/library").Decimal;
                minStock: import("@prisma/client/runtime/library").Decimal;
            } | null;
        } & {
            name: string;
            id: number;
            isActive: boolean;
            ingredientId: number | null;
            modifierGroupId: number;
            priceOverlay: import("@prisma/client/runtime/library").Decimal;
            qtyUsed: import("@prisma/client/runtime/library").Decimal | null;
        })[];
    } & {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        minSelection: number;
        maxSelection: number;
    }) | null>;
    createGroup: (data: CreateGroupInput) => Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        minSelection: number;
        maxSelection: number;
    }>;
    updateGroup: (id: number, data: UpdateGroupInput) => Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        minSelection: number;
        maxSelection: number;
    }>;
    deleteGroup: (id: number) => Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        minSelection: number;
        maxSelection: number;
    }>;
    addOption: (groupId: number, data: CreateOptionInput) => Promise<{
        name: string;
        id: number;
        isActive: boolean;
        ingredientId: number | null;
        modifierGroupId: number;
        priceOverlay: import("@prisma/client/runtime/library").Decimal;
        qtyUsed: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    updateOption: (optionId: number, data: UpdateOptionInput) => Promise<{
        name: string;
        id: number;
        isActive: boolean;
        ingredientId: number | null;
        modifierGroupId: number;
        priceOverlay: import("@prisma/client/runtime/library").Decimal;
        qtyUsed: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    deleteOption: (optionId: number) => Promise<{
        name: string;
        id: number;
        isActive: boolean;
        ingredientId: number | null;
        modifierGroupId: number;
        priceOverlay: import("@prisma/client/runtime/library").Decimal;
        qtyUsed: import("@prisma/client/runtime/library").Decimal | null;
    }>;
};
//# sourceMappingURL=modifier.service.d.ts.map