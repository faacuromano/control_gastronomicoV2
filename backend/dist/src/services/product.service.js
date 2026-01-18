"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.toggleProductActive = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = void 0;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const IngredientInput = zod_1.z.object({
    ingredientId: zod_1.z.number(),
    quantity: zod_1.z.number().positive()
});
const ProductSchema = zod_1.z.object({
    categoryId: zod_1.z.number(),
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().min(0, "Price must be non-negative"),
    productType: zod_1.z.enum(['SIMPLE', 'COMBO', 'RECIPE']).optional(),
    isStockable: zod_1.z.boolean().optional(),
    image: zod_1.z.string().url().optional(),
    isActive: zod_1.z.boolean().optional(),
    ingredients: zod_1.z.array(IngredientInput).optional(),
    modifierIds: zod_1.z.array(zod_1.z.number()).optional()
});
const getProducts = async (where = {}) => {
    return await prisma_1.prisma.product.findMany({
        where,
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
        orderBy: { name: 'asc' }
    });
};
exports.getProducts = getProducts;
const getProductById = async (id) => {
    const product = await prisma_1.prisma.product.findUnique({
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
    if (!product)
        throw new errors_1.NotFoundError('Product');
    return product;
};
exports.getProductById = getProductById;
const createProduct = async (data) => {
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid data', validation.error.issues);
    }
    const category = await prisma_1.prisma.category.findUnique({ where: { id: validation.data.categoryId } });
    if (!category)
        throw new errors_1.ValidationError('Invalid Category ID');
    const { ingredients, modifierIds, ...productData } = validation.data;
    const createData = {
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
    return await prisma_1.prisma.product.create({
        data: createData,
        include: { ingredients: true, modifiers: true }
    });
};
exports.createProduct = createProduct;
const updateProduct = async (id, data) => {
    const validation = ProductSchema.partial().safeParse(data);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid data', validation.error.issues);
    }
    const exists = await prisma_1.prisma.product.findUnique({ where: { id } });
    if (!exists)
        throw new errors_1.NotFoundError('Product');
    if (validation.data.categoryId) {
        const category = await prisma_1.prisma.category.findUnique({ where: { id: validation.data.categoryId } });
        if (!category)
            throw new errors_1.ValidationError('Invalid Category ID');
    }
    const { ingredients, modifierIds, ...productData } = validation.data;
    const updateData = { ...productData };
    if (productData.description === undefined && data.description === null)
        updateData.description = null; // Explicit null handling
    if (productData.image === undefined && data.image === null)
        updateData.image = null;
    // Transaction to handle ingredients update (delete all & recreate is simplest approach for full replacement)
    // For partial updates it's harder, so we assume "ingredients" in update replaces the whole list.
    return await prisma_1.prisma.$transaction(async (tx) => {
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
exports.updateProduct = updateProduct;
const toggleProductActive = async (id) => {
    const product = await prisma_1.prisma.product.findUnique({ where: { id } });
    if (!product)
        throw new errors_1.NotFoundError('Product');
    return await prisma_1.prisma.product.update({
        where: { id },
        data: { isActive: !product.isActive }
    });
};
exports.toggleProductActive = toggleProductActive;
const deleteProduct = async (id) => {
    // Check if exists
    const product = await prisma_1.prisma.product.findUnique({ where: { id } });
    if (!product)
        throw new errors_1.NotFoundError('Product');
    return await prisma_1.prisma.product.update({
        where: { id },
        data: { isActive: false }
    });
};
exports.deleteProduct = deleteProduct;
//# sourceMappingURL=product.service.js.map