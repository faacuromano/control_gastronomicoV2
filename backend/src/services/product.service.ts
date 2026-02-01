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

export const getProducts = async (tenantId: number, where: Prisma.ProductWhereInput = {}, page = 1, limit = 500) => {
    const take = Math.min(limit, 500);
    const skip = (page - 1) * take;
    const filter = { ...where, tenantId };

    const [data, total] = await Promise.all([
        prisma.product.findMany({
            where: filter,
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
            },
            orderBy: { name: 'asc' },
            skip,
            take
        }),
        prisma.product.count({ where: filter })
    ]);

    return { data, total, page, limit: take };
};

export const getProductById = async (id: number, tenantId: number) => {
    const product = await prisma.product.findFirst({
        where: { id, tenantId },
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

const prepareProductData = (
    data: z.infer<typeof ProductSchema>,
    tenantId: number
): Prisma.ProductUncheckedCreateInput => {
    const { ingredients, modifierIds, ...productData } = data;

    const createData: Prisma.ProductUncheckedCreateInput = {
        ...productData,
        tenantId,
        productType: productData.productType ?? 'SIMPLE',
        description: productData.description ?? null,
        image: productData.image ?? null,
        isStockable: productData.isStockable ?? true,
        isActive: productData.isActive ?? true
    };

    if (ingredients && ingredients.length > 0) {
        createData.ingredients = {
            create: ingredients.map(ing => ({
                tenantId,
                ingredientId: ing.ingredientId,
                quantity: ing.quantity
            }))
        };
    }

    if (modifierIds && modifierIds.length > 0) {
        createData.modifiers = {
            create: modifierIds.map(groupId => ({
                tenantId,
                modifierGroupId: groupId
            }))
        };
    }

    return createData;
};

export const createProduct = async (data: any) => {
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }
    
    // Validate Tenant context (must be passed in data)
    const tenantId = data.tenantId;
    if (!tenantId) throw new ValidationError('Tenant ID required');

    const category = await prisma.category.findFirst({ where: { id: validation.data.categoryId, tenantId } });
    if (!category) throw new ValidationError('Invalid Category ID for this tenant');

    const { ingredients, modifierIds, ...productData } = validation.data;

    // Validate relationships belong to tenant
    if (ingredients && ingredients.length > 0) {
        const ingIds = ingredients.map(i => i.ingredientId);
        const count = await prisma.ingredient.count({
            where: { id: { in: ingIds }, tenantId }
        });
        if (count !== ingIds.length) throw new ValidationError('One or more ingredients do not belong to this tenant');
    }

    if (modifierIds && modifierIds.length > 0) {
         const count = await prisma.modifierGroup.count({
            where: { id: { in: modifierIds }, tenantId }
        });
        if (count !== modifierIds.length) throw new ValidationError('One or more modifier groups do not belong to this tenant');
    }

    const createData = prepareProductData(validation.data, tenantId);

    return await prisma.product.create({
        data: createData,
        include: { ingredients: true, modifiers: true }
    });
};

export const updateProduct = async (id: number, tenantId: number, data: any) => {
    const validation = ProductSchema.partial().safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    const exists = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Product');

    if (validation.data.categoryId) {
        const category = await prisma.category.findFirst({ where: { id: validation.data.categoryId, tenantId } });
        if (!category) throw new ValidationError('Invalid Category ID for this tenant');
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
            await tx.productIngredient.deleteMany({ where: { productId: id, tenantId } });
            // Create new
            await tx.productIngredient.createMany({
                data: ingredients.map(ing => ({
                    tenantId,
                    productId: id,
                    ingredientId: ing.ingredientId,
                    quantity: ing.quantity
                }))
            });
        }

        if (modifierIds) {
            // Delete existing modifiers
            await tx.productModifierGroup.deleteMany({ where: { productId: id, tenantId } });
            // Create new
            await tx.productModifierGroup.createMany({
                 data: modifierIds.map(groupId => ({
                    tenantId,
                    productId: id,
                    modifierGroupId: groupId
                }))
            });
        }

        // SAFE: findFirst L144 verifies tenant ownership
        return await tx.product.update({
            where: { id },
            data: updateData,
            include: { ingredients: true, modifiers: true }
        });
    });
};

export const toggleProductActive = async (id: number, tenantId: number) => {
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundError('Product');

    return await prisma.product.updateMany({
        where: { id, tenantId },
        data: { isActive: !product.isActive }
    });
};

export const deleteProduct = async (id: number, tenantId: number) => {
    // Check if exists
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundError('Product');

    return await prisma.product.updateMany({
        where: { id, tenantId },
        data: { isActive: false }
    });
};
