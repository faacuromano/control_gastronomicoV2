"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategories = void 0;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const CategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    printerId: zod_1.z.number().optional(),
});
const getCategories = async () => {
    return await prisma_1.prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } }
    });
};
exports.getCategories = getCategories;
const getCategoryById = async (id) => {
    const category = await prisma_1.prisma.category.findUnique({
        where: { id },
        include: { products: true }
    });
    if (!category)
        throw { code: 'NOT_FOUND', message: 'Category not found' };
    return category;
};
exports.getCategoryById = getCategoryById;
const createCategory = async (data) => {
    const validation = CategorySchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
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
        throw { code: 'VALIDATION_ERROR', message: 'Invalid data', details: validation.error.issues };
    }
    const exists = await prisma_1.prisma.category.findUnique({ where: { id } });
    if (!exists)
        throw { code: 'NOT_FOUND', message: 'Category not found' };
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
    const exists = await prisma_1.prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!exists)
        throw { code: 'NOT_FOUND', message: 'Category not found' };
    if (exists._count.products > 0) {
        throw { code: 'CONFLICT', message: 'Cannot delete category with products' };
    }
    return await prisma_1.prisma.category.delete({
        where: { id }
    });
};
exports.deleteCategory = deleteCategory;
//# sourceMappingURL=category.service.js.map