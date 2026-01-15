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
} & {
    name: string;
    id: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    categoryId: number;
    description: string | null;
    price: import("@prisma/client/runtime/library").Decimal;
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
    image: string | null;
})[]>;
export declare const getProductById: (id: number) => Promise<{
    category: {
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number | null;
    };
    ingredients: {
        ingredientId: number;
        quantity: import("@prisma/client/runtime/library").Decimal;
        productId: number;
    }[];
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
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
    image: string | null;
}>;
export declare const createProduct: (data: any) => Promise<{
    name: string;
    id: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    categoryId: number;
    description: string | null;
    price: import("@prisma/client/runtime/library").Decimal;
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
    image: string | null;
}>;
export declare const updateProduct: (id: number, data: any) => Promise<{
    name: string;
    id: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    categoryId: number;
    description: string | null;
    price: import("@prisma/client/runtime/library").Decimal;
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
    image: string | null;
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
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
    image: string | null;
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
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
    image: string | null;
}>;
//# sourceMappingURL=product.service.d.ts.map