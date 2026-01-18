"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategories = void 0;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const CategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    printerId: zod_1.z.number().optional(),
});
const getCategories = async () => {
    const categories = await prisma_1.prisma.category.findMany({
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
exports.getCategories = getCategories;
const getCategoryById = async (id) => {
    const category = await prisma_1.prisma.category.findUnique({
        where: { id },
        include: { products: true }
    });
    if (!category)
        throw new errors_1.NotFoundError('Category');
    return category;
};
exports.getCategoryById = getCategoryById;
const createCategory = async (data) => {
    const validation = CategorySchema.safeParse(data);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid data', validation.error.issues);
    }
    return await prisma_1.prisma.category.create({
        data: {
            name: validation.data.name,
            printerId: validation.data.printerId ?? null
        }
    });
};
exports.createCategory = createCategory;
const updateCategory = async (id, data) => {
    const validation = CategorySchema.partial().safeParse(data);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid data', validation.error.issues);
    }
    const exists = await prisma_1.prisma.category.findUnique({ where: { id } });
    if (!exists)
        throw new errors_1.NotFoundError('Category');
    const updateData = { ...validation.data };
    if (validation.data.printerId === undefined)
        delete updateData.printerId;
    return await prisma_1.prisma.category.update({
        where: { id },
        data: updateData
    });
};
exports.updateCategory = updateCategory;
const deleteCategory = async (id) => {
    const category = await prisma_1.prisma.category.findUnique({
        where: { id },
        include: { products: { select: { isActive: true } } }
    });
    if (!category)
        throw new errors_1.NotFoundError('Category');
    const activeProducts = category.products.filter(p => p.isActive);
    const inactiveProducts = category.products.filter(p => !p.isActive);
    if (activeProducts.length > 0) {
        throw new errors_1.ConflictError('Cannot delete category with active products');
    }
    // If we have inactive products, delete them first to allow category deletion
    if (inactiveProducts.length > 0) {
        await prisma_1.prisma.product.deleteMany({
            where: { categoryId: id }
        });
    }
    return await prisma_1.prisma.category.delete({
        where: { id }
    });
};
exports.deleteCategory = deleteCategory;
//# sourceMappingURL=category.service.js.map