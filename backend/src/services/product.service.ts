import { prisma } from '../lib/prisma';
import { z } from 'zod';

const IngredientInput = z.object({
  ingredientId: z.number(),
  quantity: z.number().positive()
});

const ProductSchema = z.object({
    categoryId: z.number(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price: z.number().min(0, "Price must be non-negative"),
    productType: z.enum(['SIMPLE', 'COMBO', 'RECIPE']).optional(),
    isStockable: z.boolean().optional(),
    image: z.string().url().optional(),
    isActive: z.boolean().optional(),
    ingredients: z.array(IngredientInput).optional()
});

export const getProducts = async (filters: { categoryId?: number; isActive?: boolean } = {}) => {
    const where: any = {};
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return await prisma.product.findMany({
        where,
        include: { category: true, ingredients: { include: { ingredient: true } } },
        orderBy: { name: 'asc' }
    });
};

export const getProductById = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: { category: true, ingredients: { include: { ingredient: true } }, modifiers: true }
    });
    if (!product) throw { code: 'NOT_FOUND', message: 'Product not found' };
    return product;
};

export const createProduct = async (data: any) => {
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }

    const category = await prisma.category.findUnique({ where: { id: validation.data.categoryId } });
    if (!category) throw { code: 'VALIDATION_ERROR', message: 'Invalid Category ID' };

    const { ingredients, ...productData } = validation.data;

    const createData: any = {
        ...productData,
        productType: productData.productType,
        description: productData.description ?? null,
        image: productData.image ?? null,
        isStockable: productData.isStockable ?? true,
        isActive: productData.isActive ?? true
    };

    if (ingredients && ingredients.length > 0) {
        createData.ingredients = {
            create: ingredients.map(ing => ({
                ingredientId: ing.ingredientId,
                quantity: ing.quantity
            }))
        };
    }

    return await prisma.product.create({
        data: createData,
        include: { ingredients: true }
    });
};

export const updateProduct = async (id: number, data: any) => {
    const validation = ProductSchema.partial().safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) throw { code: 'NOT_FOUND', message: 'Product not found' };

    if (validation.data.categoryId) {
        const category = await prisma.category.findUnique({ where: { id: validation.data.categoryId } });
        if (!category) throw { code: 'VALIDATION_ERROR', message: 'Invalid Category ID' };
    }

    const { ingredients, ...productData } = validation.data;
    const updateData: any = { ...productData };
    if (productData.description === undefined && data.description === null) updateData.description = null; // Explicit null handling
    if (productData.image === undefined && data.image === null) updateData.image = null;

    // Transaction to handle ingredients update (delete all & recreate is simplest approach for full replacement)
    // For partial updates it's harder, so we assume "ingredients" in update replaces the whole list.
    
    return await prisma.$transaction(async (tx) => {
        if (ingredients) {
            // Delete existing
            await tx.productIngredient.deleteMany({ where: { productId: id } });
            // Create new
            await tx.productIngredient.createMany({
                data: ingredients.map(ing => ({
                    productId: id,
                    ingredientId: ing.ingredientId,
                    quantity: ing.quantity
                }))
            });
        }

        return await tx.product.update({
            where: { id },
            data: updateData,
            include: { ingredients: true }
        });
    });
};

export const toggleProductActive = async (id: number) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw { code: 'NOT_FOUND', message: 'Product not found' };

    return await prisma.product.update({
        where: { id },
        data: { isActive: !product.isActive }
    });
};

export const deleteProduct = async (id: number) => {
    return await prisma.product.update({
        where: { id },
        data: { isActive: false }
    });
};
