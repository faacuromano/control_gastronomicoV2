import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

const CategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    printerId: z.number().optional(),
});

export const getCategories = async (tenantId: number) => {
    const categories = await prisma.category.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        include: {
            products: {
                select: { isActive: true }
            }
        }
    });

    return categories.map(category => ({
        id: category.id,
        name: category.name,
        printerId: category.printerId,
        // Count active products for POS filtering
        activeProductsCount: category.products.filter(p => p.isActive).length,
        // Total products for internal use/admin
        totalProductsCount: category.products.length
    }));
};

export const getCategoryById = async (id: number, tenantId: number) => {
    const category = await prisma.category.findFirst({
        where: { id, tenantId },
        include: { products: true }
    });
    if (!category) throw new NotFoundError('Category');
    return category;
};

export const createCategory = async (data: any) => {
    const validation = CategorySchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    return await prisma.category.create({
        data: {
            tenantId: data.tenantId,
            name: validation.data.name,
            printerId: validation.data.printerId ?? null
        }
    });
};

export const updateCategory = async (id: number, tenantId: number, data: any) => {
    const validation = CategorySchema.partial().safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    const exists = await prisma.category.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Category');

    const updateData: any = { ...validation.data };
    if (validation.data.printerId === undefined) delete updateData.printerId;

    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return await prisma.category.updateMany({
        where: { id, tenantId },
        data: updateData
    });
};

export const deleteCategory = async (id: number, tenantId: number) => {
    const category = await prisma.category.findFirst({ 
        where: { id, tenantId }, 
        include: { products: { select: { isActive: true } } } 
    });

    if (!category) throw new NotFoundError('Category');

    const activeProducts = category.products.filter(p => p.isActive);
    const inactiveProducts = category.products.filter(p => !p.isActive);

    if (activeProducts.length > 0) {
        throw new ConflictError('Cannot delete category with active products');
    }

    // If we have inactive products, delete them first to allow category deletion
    if (inactiveProducts.length > 0) {
        await prisma.product.deleteMany({
            where: { categoryId: id, tenantId }
        });
    }

    // defense-in-depth: deleteMany ensures tenantId is in the WHERE clause
    return await prisma.category.deleteMany({
        where: { id, tenantId }
    });
};
