import { Prisma } from '@prisma/client';
export declare const getProducts: (where?: Prisma.ProductWhereInput) => Promise<({
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
            cost: Prisma.Decimal;
            stock: Prisma.Decimal;
            minStock: Prisma.Decimal;
        };
    } & {
        ingredientId: number;
        quantity: Prisma.Decimal;
        productId: number;
    })[];
    modifiers: ({
        modifierGroup: {
            options: {
                name: string;
                id: number;
                isActive: boolean;
                ingredientId: number | null;
                modifierGroupId: number;
                priceOverlay: Prisma.Decimal;
                qtyUsed: Prisma.Decimal | null;
            }[];
        } & {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            minSelection: number;
            maxSelection: number;
        };
    } & {
        productId: number;
        modifierGroupId: number;
    })[];
} & {
    name: string;
    id: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    categoryId: number;
    description: string | null;
    price: Prisma.Decimal;
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
            cost: Prisma.Decimal;
            stock: Prisma.Decimal;
            minStock: Prisma.Decimal;
        };
    } & {
        ingredientId: number;
        quantity: Prisma.Decimal;
        productId: number;
    })[];
    modifiers: ({
        modifierGroup: {
            options: {
                name: string;
                id: number;
                isActive: boolean;
                ingredientId: number | null;
                modifierGroupId: number;
                priceOverlay: Prisma.Decimal;
                qtyUsed: Prisma.Decimal | null;
            }[];
        } & {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            minSelection: number;
            maxSelection: number;
        };
    } & {
        productId: number;
        modifierGroupId: number;
    })[];
} & {
    name: string;
    id: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    categoryId: number;
    description: string | null;
    price: Prisma.Decimal;
    image: string | null;
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
}>;
export declare const createProduct: (data: any) => Promise<{
    ingredients: {
        ingredientId: number;
        quantity: Prisma.Decimal;
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
    price: Prisma.Decimal;
    image: string | null;
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
}>;
export declare const updateProduct: (id: number, data: any) => Promise<{
    ingredients: {
        ingredientId: number;
        quantity: Prisma.Decimal;
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
    price: Prisma.Decimal;
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
    price: Prisma.Decimal;
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
    price: Prisma.Decimal;
    image: string | null;
    productType: import(".prisma/client").$Enums.ProductType;
    isStockable: boolean;
}>;
//# sourceMappingURL=product.service.d.ts.map