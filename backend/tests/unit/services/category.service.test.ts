/**
 * Unit tests for category.service
 * Tests: getCategories, getCategoryById, createCategory, updateCategory, deleteCategory
 */

// --- Mocks MUST come before imports ---

const mockCategory = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
};

const mockProduct = {
    deleteMany: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
    prisma: {
        category: mockCategory,
        product: mockProduct,
        $transaction: (...args: any[]) => mockTransaction(...args),
    },
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Imports after mocks ---

import {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../../../src/services/category.service';

const TENANT_ID = 1;

const createMockCategory = (overrides = {}) => ({
    id: 1,
    name: 'Bebidas',
    tenantId: TENANT_ID,
    printerId: null,
    kdsStationId: null,
    kdsStation: null,
    products: [],
    ...overrides,
});

describe('Category Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- getCategories ---

    describe('getCategories', () => {
        it('returns categories with product counts', async () => {
            mockCategory.findMany.mockResolvedValue([
                createMockCategory({
                    products: [
                        { isActive: true },
                        { isActive: true },
                        { isActive: false },
                    ],
                }),
            ]);

            const result = await getCategories(TENANT_ID);

            expect(result).toHaveLength(1);
            expect(result[0].activeProductsCount).toBe(2);
            expect(result[0].totalProductsCount).toBe(3);
        });

        it('returns empty array when no categories', async () => {
            mockCategory.findMany.mockResolvedValue([]);

            const result = await getCategories(TENANT_ID);

            expect(result).toHaveLength(0);
        });
    });

    // --- getCategoryById ---

    describe('getCategoryById', () => {
        it('returns category with products', async () => {
            const cat = createMockCategory({ products: [{ id: 1 }] });
            mockCategory.findFirst.mockResolvedValue(cat);

            const result = await getCategoryById(1, TENANT_ID);

            expect(result).toEqual(cat);
            expect(mockCategory.findFirst).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                include: { products: true },
            });
        });

        it('throws NotFoundError for non-existent category', async () => {
            mockCategory.findFirst.mockResolvedValue(null);

            await expect(getCategoryById(999, TENANT_ID)).rejects.toThrow();
        });
    });

    // --- createCategory ---

    describe('createCategory', () => {
        it('creates a category with valid data', async () => {
            const cat = createMockCategory({ name: 'Postres' });
            mockCategory.create.mockResolvedValue(cat);

            const result = await createCategory({ tenantId: TENANT_ID, name: 'Postres' });

            expect(result.name).toBe('Postres');
            expect(mockCategory.create).toHaveBeenCalledWith({
                data: { tenantId: TENANT_ID, name: 'Postres', printerId: null },
            });
        });

        it('creates a category with printerId', async () => {
            const cat = createMockCategory({ printerId: 5 });
            mockCategory.create.mockResolvedValue(cat);

            const result = await createCategory({ tenantId: TENANT_ID, name: 'Cocina', printerId: 5 });

            expect(result.printerId).toBe(5);
        });

        it('throws ValidationError for empty name', async () => {
            await expect(createCategory({ tenantId: TENANT_ID, name: '' })).rejects.toThrow(
                'Invalid data'
            );
        });

        it('throws ValidationError for name exceeding max length', async () => {
            await expect(
                createCategory({ tenantId: TENANT_ID, name: 'A'.repeat(101) })
            ).rejects.toThrow('Invalid data');
        });
    });

    // --- updateCategory ---

    describe('updateCategory', () => {
        it('updates category name', async () => {
            mockCategory.findFirst.mockResolvedValue(createMockCategory());
            mockCategory.updateMany.mockResolvedValue({ count: 1 });

            await updateCategory(1, TENANT_ID, { name: 'Entradas' });

            expect(mockCategory.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { name: 'Entradas' },
            });
        });

        it('updates printerId to null', async () => {
            mockCategory.findFirst.mockResolvedValue(createMockCategory({ printerId: 5 }));
            mockCategory.updateMany.mockResolvedValue({ count: 1 });

            await updateCategory(1, TENANT_ID, { printerId: null });

            expect(mockCategory.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { printerId: null },
            });
        });

        it('throws NotFoundError for non-existent category', async () => {
            mockCategory.findFirst.mockResolvedValue(null);

            await expect(updateCategory(999, TENANT_ID, { name: 'X' })).rejects.toThrow();
        });
    });

    // --- deleteCategory ---

    describe('deleteCategory', () => {
        it('deletes empty category', async () => {
            const txCategory = {
                findFirst: jest.fn().mockResolvedValue(createMockCategory({ products: [] })),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            };
            const txProduct = { deleteMany: jest.fn() };
            mockTransaction.mockImplementation(async (fn: any) =>
                fn({ category: txCategory, product: txProduct })
            );

            await deleteCategory(1, TENANT_ID);

            expect(txCategory.deleteMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
            });
        });

        it('deletes category with inactive products (cascade)', async () => {
            const txCategory = {
                findFirst: jest.fn().mockResolvedValue(
                    createMockCategory({ products: [{ isActive: false }, { isActive: false }] })
                ),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            };
            const txProduct = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };
            mockTransaction.mockImplementation(async (fn: any) =>
                fn({ category: txCategory, product: txProduct })
            );

            await deleteCategory(1, TENANT_ID);

            expect(txProduct.deleteMany).toHaveBeenCalledWith({
                where: { categoryId: 1, tenantId: TENANT_ID },
            });
            expect(txCategory.deleteMany).toHaveBeenCalled();
        });

        it('throws ConflictError when category has active products', async () => {
            const txCategory = {
                findFirst: jest.fn().mockResolvedValue(
                    createMockCategory({ products: [{ isActive: true }] })
                ),
            };
            mockTransaction.mockImplementation(async (fn: any) =>
                fn({ category: txCategory, product: mockProduct })
            );

            await expect(deleteCategory(1, TENANT_ID)).rejects.toThrow(
                /active products/
            );
        });

        it('throws NotFoundError for non-existent category', async () => {
            const txCategory = { findFirst: jest.fn().mockResolvedValue(null) };
            mockTransaction.mockImplementation(async (fn: any) =>
                fn({ category: txCategory, product: mockProduct })
            );

            await expect(deleteCategory(999, TENANT_ID)).rejects.toThrow();
        });
    });
});
