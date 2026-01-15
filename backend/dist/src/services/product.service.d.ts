export declare const getProducts: (filters?: {
    categoryId?: number;
    isActive?: boolean;
}) => Promise<({
    category: {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number | null;
    };
    ingredients: ({
        ingredient: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            unit: string;
            cost: import("@prisma/client/runtime/library").Decimal;
            stock: import("@prisma/client/runtime/library").Decimal;
            minStock: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        ingredientId: number;
        quantity: import("@prisma/client/runtime/library").Decimal;
        productId: number;
    })[];
} & {
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
})[]>;
export declare const getProductById: (id: number) => Promise<{
    category: {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number | null;
    };
    ingredients: ({
        ingredient: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            unit: string;
            cost: import("@prisma/client/runtime/library").Decimal;
            stock: import("@prisma/client/runtime/library").Decimal;
            minStock: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        ingredientId: number;
        quantity: import("@prisma/client/runtime/library").Decimal;
        productId: number;
    })[];
    modifiers: {
        productId: number;
        modifierGroupId: number;
    }[];
} & {
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
}>;
export declare const createProduct: (data: any) => Promise<{
    ingredients: {
        ingredientId: number;
        quantity: import("@prisma/client/runtime/library").Decimal;
        productId: number;
    }[];
} & {
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
}>;
export declare const updateProduct: (id: number, data: any) => Promise<{
    ingredients: {
        ingredientId: number;
        quantity: import("@prisma/client/runtime/library").Decimal;
        productId: number;
    }[];
} & {
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
}>;
export declare const toggleProductActive: (id: number) => Promise<{
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
}>;
export declare const deleteProduct: (id: number) => Promise<{
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
}>;
//# sourceMappingURL=product.service.d.ts.map