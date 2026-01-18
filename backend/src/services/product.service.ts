import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

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
    ingredients: z.array(IngredientInput).optional(),
    modifierIds: z.array(z.number()).optional()
});

export const getProducts = async (where: Prisma.ProductWhereInput = {}) => {
    return await prisma.product.findMany({
        where,
        include: { 
            category: true, 
            ingredients: { include: { ingredient: true } },
            modifiers: { // ProductModifierGroup
                include: {
                    modifierGroup: {
                        include: { options: true }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });
};

export const getProductById = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: { 
            category: true, 
            ingredients: { include: { ingredient: true } }, 
            modifiers: {
                include: {
                    modifierGroup: {
                        include: { options: true }
                    }
                }
            } 
        }
    });
    if (!product) throw new NotFoundError('Product');
    return product;
};

export const createProduct = async (data: any) => {
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    const category = await prisma.category.findUnique({ where: { id: validation.data.categoryId } });
    if (!category) throw new ValidationError('Invalid Category ID');

    const { ingredients, modifierIds, ...productData } = validation.data;

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

    if (modifierIds && modifierIds.length > 0) {
        createData.modifiers = {
            create: modifierIds.map(groupId => ({
                modifierGroupId: groupId
            }))
        };
    }

    return await prisma.product.create({
        data: createData,
        include: { ingredients: true, modifiers: true }
    });
};

export const updateProduct = async (id: number, data: any) => {
    const validation = ProductSchema.partial().safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundError('Product');

    if (validation.data.categoryId) {
        const category = await prisma.category.findUnique({ where: { id: validation.data.categoryId } });
        if (!category) throw new ValidationError('Invalid Category ID');
    }

    const { ingredients, modifierIds, ...productData } = validation.data;
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

        if (modifierIds) {
            // Delete existing modifiers
            await tx.productModifierGroup.deleteMany({ where: { productId: id } });
            // Create new
            await tx.productModifierGroup.createMany({
                 data: modifierIds.map(groupId => ({
                    productId: id,
                    modifierGroupId: groupId
                }))
            });
        }

        return await tx.product.update({
            where: { id },
            data: updateData,
            include: { ingredients: true, modifiers: true }
        });
    });
};

export const toggleProductActive = async (id: number) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    return await prisma.product.update({
        where: { id },
        data: { isActive: !product.isActive }
    });
};

export const deleteProduct = async (id: number) => {
    // Check if exists
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    return await prisma.product.update({
        where: { id },
        data: { isActive: false }
    });
};
