"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngredientService = void 0;
const prisma_1 = require("../lib/prisma");
class IngredientService {
    async getAll() {
        return await prisma_1.prisma.ingredient.findMany({
            orderBy: { name: 'asc' }
        });
    }
    async getById(id) {
        return await prisma_1.prisma.ingredient.findUnique({
            where: { id }
        });
    }
    async create(data) {
        return await prisma_1.prisma.ingredient.create({
            data: {
                name: data.name,
                unit: data.unit,
                cost: data.cost,
                stock: data.stock,
                minStock: data.minStock || 0
            }
        });
    }
    async update(id, data) {
        return await prisma_1.prisma.ingredient.update({
            where: { id },
            data
        });
    }
    async delete(id) {
        // Check if used in any product or modifier
        const usageCount = await prisma_1.prisma.productIngredient.count({ where: { ingredientId: id } });
        if (usageCount > 0) {
            throw new Error('Cannot delete ingredient used in products.');
        }
        return await prisma_1.prisma.ingredient.delete({
            where: { id }
        });
    }
}
exports.IngredientService = IngredientService;
//# sourceMappingURL=ingredient.service.js.map