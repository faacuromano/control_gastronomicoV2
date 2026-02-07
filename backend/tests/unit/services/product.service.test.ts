/**
 * Unit tests for product.service
 * Tests: getProducts, getProductById, createProduct, updateProduct, toggleProductActive, deleteProduct
 */

// --- Mocks MUST come before imports ---

const mockProduct = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockCategory = {
    findFirst: jest.fn(),
};

const mockIngredient = {
    count: jest.fn(),
};

const mockModifierGroup = {
    count: jest.fn(),
};

const mockProductIngredient = {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
};

const mockProductModifierGroup = {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
    prisma: {
        product: mockProduct,
        category: mockCategory,
        ingredient: mockIngredient,
        modifierGroup: mockModifierGroup,
        productIngredient: mockProductIngredient,
        productModifierGroup: mockProductModifierGroup,
        $transaction: (...args: any[]) => mockTransaction(...args),
    },
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Imports after mocks ---

import {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    toggleProductActive,
    deleteProduct,
} from '../../../src/services/product.service';

const TENANT_ID = 1;

const createMockProduct = (overrides = {}) => ({
    id: 1,
    name: 'Hamburguesa Clásica',
    price: 2500,
    categoryId: 1,
    tenantId: TENANT_ID,
    productType: 'SIMPLE',
    isStockable: true,
    isActive: true,
    description: null,
    image: null,
    kdsStationId: null,
    category: { id: 1, name: 'Comidas' },
    kdsStation: null,
    ingredients: [],
    modifiers: [],
    ...overrides,
});

describe('Product Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- getProducts ---

    describe('getProducts', () => {
        it('returns paginated products', async () => {
            const products = [createMockProduct()];
            mockProduct.findMany.mockResolvedValue(products);
            mockProduct.count.mockResolvedValue(1);

            const result = await getProducts(TENANT_ID);

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(mockProduct.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { tenantId: TENANT_ID },
                })
            );
        });

        it('respects page and limit parameters', async () => {
            mockProduct.findMany.mockResolvedValue([]);
            mockProduct.count.mockResolvedValue(50);

            const result = await getProducts(TENANT_ID, {}, 2, 10);

            expect(result.page).toBe(2);
            expect(mockProduct.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 10, take: 10 })
            );
        });

        it('caps limit at 500', async () => {
            mockProduct.findMany.mockResolvedValue([]);
            mockProduct.count.mockResolvedValue(0);

            await getProducts(TENANT_ID, {}, 1, 1000);

            expect(mockProduct.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 500 })
            );
        });

        it('merges additional where filters', async () => {
            mockProduct.findMany.mockResolvedValue([]);
            mockProduct.count.mockResolvedValue(0);

            await getProducts(TENANT_ID, { isActive: true });

            expect(mockProduct.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { isActive: true, tenantId: TENANT_ID },
                })
            );
        });
    });

    // --- getProductById ---

    describe('getProductById', () => {
        it('returns product with relations', async () => {
            const product = createMockProduct();
            mockProduct.findFirst.mockResolvedValue(product);

            const result = await getProductById(1, TENANT_ID);

            expect(result).toEqual(product);
            expect(mockProduct.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1, tenantId: TENANT_ID },
                })
            );
        });

        it('throws NotFoundError for non-existent product', async () => {
            mockProduct.findFirst.mockResolvedValue(null);

            await expect(getProductById(999, TENANT_ID)).rejects.toThrow();
        });
    });

    // --- createProduct ---

    describe('createProduct', () => {
        it('creates a simple product', async () => {
            const product = createMockProduct();
            mockCategory.findFirst.mockResolvedValue({ id: 1, tenantId: TENANT_ID });
            mockProduct.create.mockResolvedValue(product);

            const result = await createProduct({
                tenantId: TENANT_ID,
                categoryId: 1,
                name: 'Hamburguesa Clásica',
                price: 2500,
            });

            expect(result).toEqual(product);
            expect(mockCategory.findFirst).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
            });
        });

        it('validates ingredients belong to tenant', async () => {
            mockCategory.findFirst.mockResolvedValue({ id: 1, tenantId: TENANT_ID });
            mockIngredient.count.mockResolvedValue(1); // Only 1 of 2 ingredients found

            await expect(
                createProduct({
                    tenantId: TENANT_ID,
                    categoryId: 1,
                    name: 'Test',
                    price: 100,
                    ingredients: [
                        { ingredientId: 1, quantity: 2 },
                        { ingredientId: 999, quantity: 1 },
                    ],
                })
            ).rejects.toThrow(/ingredients do not belong/);
        });

        it('validates modifier groups belong to tenant', async () => {
            mockCategory.findFirst.mockResolvedValue({ id: 1, tenantId: TENANT_ID });
            mockModifierGroup.count.mockResolvedValue(0);

            await expect(
                createProduct({
                    tenantId: TENANT_ID,
                    categoryId: 1,
                    name: 'Test',
                    price: 100,
                    modifierIds: [999],
                })
            ).rejects.toThrow(/modifier groups do not belong/);
        });

        it('throws ValidationError for missing name', async () => {
            await expect(
                createProduct({ tenantId: TENANT_ID, categoryId: 1, name: '', price: 100 })
            ).rejects.toThrow('Invalid data');
        });

        it('throws ValidationError for negative price', async () => {
            await expect(
                createProduct({ tenantId: TENANT_ID, categoryId: 1, name: 'X', price: -10 })
            ).rejects.toThrow('Invalid data');
        });

        it('throws ValidationError for missing tenantId', async () => {
            await expect(
                createProduct({ categoryId: 1, name: 'X', price: 100 })
            ).rejects.toThrow('Tenant ID required');
        });

        it('throws ValidationError for invalid category', async () => {
            mockCategory.findFirst.mockResolvedValue(null);

            await expect(
                createProduct({ tenantId: TENANT_ID, categoryId: 999, name: 'X', price: 100 })
            ).rejects.toThrow(/Invalid Category/);
        });
    });

    // --- updateProduct ---

    describe('updateProduct', () => {
        it('updates product fields', async () => {
            mockProduct.findFirst.mockResolvedValue(createMockProduct());
            const txProduct = {
                update: jest.fn().mockResolvedValue(createMockProduct({ name: 'Updated', price: 3000 })),
            };
            const txProductIngredient = { deleteMany: jest.fn(), createMany: jest.fn() };
            const txProductModifierGroup = { deleteMany: jest.fn(), createMany: jest.fn() };
            mockTransaction.mockImplementation(async (fn: any) =>
                fn({
                    product: txProduct,
                    productIngredient: txProductIngredient,
                    productModifierGroup: txProductModifierGroup,
                })
            );

            const result = await updateProduct(1, TENANT_ID, { name: 'Updated', price: 3000 });

            expect(result.name).toBe('Updated');
        });

        it('replaces ingredients when provided', async () => {
            mockProduct.findFirst.mockResolvedValue(createMockProduct());
            const txProduct = { update: jest.fn().mockResolvedValue(createMockProduct()) };
            const txProductIngredient = {
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                createMany: jest.fn().mockResolvedValue({ count: 2 }),
            };
            const txProductModifierGroup = { deleteMany: jest.fn(), createMany: jest.fn() };
            mockTransaction.mockImplementation(async (fn: any) =>
                fn({
                    product: txProduct,
                    productIngredient: txProductIngredient,
                    productModifierGroup: txProductModifierGroup,
                })
            );

            await updateProduct(1, TENANT_ID, {
                ingredients: [
                    { ingredientId: 10, quantity: 2 },
                    { ingredientId: 20, quantity: 1 },
                ],
            });

            expect(txProductIngredient.deleteMany).toHaveBeenCalledWith({
                where: { productId: 1, tenantId: TENANT_ID },
            });
            expect(txProductIngredient.createMany).toHaveBeenCalledWith({
                data: [
                    { tenantId: TENANT_ID, productId: 1, ingredientId: 10, quantity: 2 },
                    { tenantId: TENANT_ID, productId: 1, ingredientId: 20, quantity: 1 },
                ],
            });
        });

        it('throws NotFoundError for non-existent product', async () => {
            mockProduct.findFirst.mockResolvedValue(null);

            await expect(updateProduct(999, TENANT_ID, { name: 'X' })).rejects.toThrow();
        });

        it('validates category belongs to tenant on change', async () => {
            mockProduct.findFirst.mockResolvedValue(createMockProduct());
            mockCategory.findFirst.mockResolvedValue(null);

            await expect(
                updateProduct(1, TENANT_ID, { categoryId: 999 })
            ).rejects.toThrow(/Invalid Category/);
        });
    });

    // --- toggleProductActive ---

    describe('toggleProductActive', () => {
        it('toggles active to inactive', async () => {
            mockProduct.findFirst.mockResolvedValue(createMockProduct({ isActive: true }));
            mockProduct.updateMany.mockResolvedValue({ count: 1 });

            await toggleProductActive(1, TENANT_ID);

            expect(mockProduct.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { isActive: false },
            });
        });

        it('toggles inactive to active', async () => {
            mockProduct.findFirst.mockResolvedValue(createMockProduct({ isActive: false }));
            mockProduct.updateMany.mockResolvedValue({ count: 1 });

            await toggleProductActive(1, TENANT_ID);

            expect(mockProduct.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { isActive: true },
            });
        });

        it('throws NotFoundError for non-existent product', async () => {
            mockProduct.findFirst.mockResolvedValue(null);
            await expect(toggleProductActive(999, TENANT_ID)).rejects.toThrow();
        });
    });

    // --- deleteProduct (soft delete) ---

    describe('deleteProduct', () => {
        it('soft deletes by setting isActive to false', async () => {
            mockProduct.findFirst.mockResolvedValue(createMockProduct());
            mockProduct.updateMany.mockResolvedValue({ count: 1 });

            await deleteProduct(1, TENANT_ID);

            expect(mockProduct.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { isActive: false },
            });
        });

        it('throws NotFoundError for non-existent product', async () => {
            mockProduct.findFirst.mockResolvedValue(null);
            await expect(deleteProduct(999, TENANT_ID)).rejects.toThrow();
        });
    });
});
