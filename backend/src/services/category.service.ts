import { prisma } from '../lib/prisma';
import { z } from 'zod';

const CategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    printerId: z.number().optional(),
});

export const getCategories = async () => {
    const categories = await prisma.category.findMany({
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

export const getCategoryById = async (id: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: { products: true }
    });
    if (!category) throw { code: 'NOT_FOUND', message: 'Category not found' };
    return category;
};

export const createCategory = async (data: any) => {
    const validation = CategorySchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }

    return await prisma.category.create({
        data: {
            name: validation.data.name,
            printerId: validation.data.printerId ?? null
        }
    });
};

export const updateCategory = async (id: number, data: any) => {
    const validation = CategorySchema.partial().safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }

    const exists = await prisma.category.findUnique({ where: { id } });
    if (!exists) throw { code: 'NOT_FOUND', message: 'Category not found' };

    const updateData: any = { ...validation.data };
    if (validation.data.printerId === undefined) delete updateData.printerId;

    return await prisma.category.update({
        where: { id },
        data: updateData
    });
};

export const deleteCategory = async (id: number) => {
    const category = await prisma.category.findUnique({ 
        where: { id }, 
        include: { products: { select: { isActive: true } } } 
    });

    if (!category) throw { code: 'NOT_FOUND', message: 'Category not found' };

    const activeProducts = category.products.filter(p => p.isActive);
    const inactiveProducts = category.products.filter(p => !p.isActive);

    if (activeProducts.length > 0) {
        throw { code: 'CONFLICT', message: 'Cannot delete category with active products' };
    }

    // If we have inactive products, delete them first to allow category deletion
    if (inactiveProducts.length > 0) {
        await prisma.product.deleteMany({
            where: { categoryId: id }
        });
    }

    return await prisma.category.delete({
        where: { id }
    });
};
