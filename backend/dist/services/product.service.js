"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.toggleProductActive = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = void 0;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const ProductSchema = zod_1.z.object({
    categoryId: zod_1.z.number(),
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().min(0, "Price must be non-negative"),
    productType: zod_1.z.enum(['SIMPLE', 'COMBO', 'RECIPE']).optional(),
    isStockable: zod_1.z.boolean().optional(),
    image: zod_1.z.string().url().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const getProducts = async (filters = {}) => {
    const where = {};
    if (filters.categoryId)
        where.categoryId = filters.categoryId;
    if (filters.isActive !== undefined)
        where.isActive = filters.isActive;
    return await prisma_1.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' }
    });
};
exports.getProducts = getProducts;
const getProductById = async (id) => {
    const product = await prisma_1.prisma.product.findUnique({
        where: { id },
        include: { category: true, ingredients: true, modifiers: true }
    });
    if (!product)
        throw { code: 'NOT_FOUND', message: 'Product not found' };
    return product;
};
exports.getProductById = getProductById;
const createProduct = async (data) => {
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }
    const category = await prisma_1.prisma.category.findUnique({ where: { id: validation.data.categoryId } });
    if (!category)
        throw { code: 'VALIDATION_ERROR', message: 'Invalid Category ID' };
    return await prisma_1.prisma.product.create({
        data: {
            ...validation.data,
            productType: validation.data.productType,
            description: validation.data.description ?? null,
            image: validation.data.image ?? null,
            isStockable: validation.data.isStockable ?? true,
            isActive: validation.data.isActive ?? true
        }
    });
};
exports.createProduct = createProduct;
const updateProduct = async (id, data) => {
    const validation = ProductSchema.partial().safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }
    const exists = await prisma_1.prisma.product.findUnique({ where: { id } });
    if (!exists)
        throw { code: 'NOT_FOUND', message: 'Product not found' };
    if (validation.data.categoryId) {
        const category = await prisma_1.prisma.category.findUnique({ where: { id: validation.data.categoryId } });
        if (!category)
            throw { code: 'VALIDATION_ERROR', message: 'Invalid Category ID' };
    }
    const updateData = { ...validation.data };
    if (validation.data.description === undefined)
        delete updateData.description;
    if (validation.data.image === undefined)
        delete updateData.image;
    return await prisma_1.prisma.product.update({
        where: { id },
        data: updateData
    });
};
exports.updateProduct = updateProduct;
const toggleProductActive = async (id) => {
    const product = await prisma_1.prisma.product.findUnique({ where: { id } });
    if (!product)
        throw { code: 'NOT_FOUND', message: 'Product not found' };
    return await prisma_1.prisma.product.update({
        where: { id },
        data: { isActive: !product.isActive }
    });
};
exports.toggleProductActive = toggleProductActive;
const deleteProduct = async (id) => {
    // Soft delete is preferred or check if it has constraints (OrderItem)
    // For now we try hard delete, if constraints fail Prisma will throw.
    // However, usually we should soft delete.
    // The requirement often says Soft Delete to keep history.
    // Let's implement soft delete strictly? Schema: isActive Boolean @default(true)
    // So "delete" could just mean set isActive false. But we have toggleProductActive.
    // Let's stick to update isActive = false as "delete".
    return await prisma_1.prisma.product.update({
        where: { id },
        data: { isActive: false }
    });
};
exports.deleteProduct = deleteProduct;
//# sourceMappingURL=product.service.js.map