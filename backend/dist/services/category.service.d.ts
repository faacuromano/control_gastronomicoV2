export declare const getCategories: () => Promise<({
    _count: {
        products: number;
    };
} & {
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    printerId: number | null;
})[]>;
export declare const getCategoryById: (id: number) => Promise<{
    products: {
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
    }[];
} & {
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    printerId: number | null;
}>;
export declare const createCategory: (data: any) => Promise<{
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    printerId: number | null;
}>;
export declare const updateCategory: (id: number, data: any) => Promise<{
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    printerId: number | null;
}>;
export declare const deleteCategory: (id: number) => Promise<{
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    printerId: number | null;
}>;
//# sourceMappingURL=category.service.d.ts.map