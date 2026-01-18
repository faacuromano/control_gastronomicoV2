"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modifierService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.modifierService = {
    getAllGroups: async () => {
        return prisma.modifierGroup.findMany({
            include: {
                options: {
                    include: {
                        ingredient: true
                    }
                },
                products: true
            },
            orderBy: { name: 'asc' }
        });
    },
    getGroupById: async (id) => {
        return prisma.modifierGroup.findUnique({
            where: { id },
            include: {
                options: {
                    include: {
                        ingredient: true
                    }
                }
            }
        });
    },
    createGroup: async (data) => {
        return prisma.modifierGroup.create({
            data: {
                name: data.name,
                minSelection: data.minSelection ?? 0,
                maxSelection: data.maxSelection ?? 1
            }
        });
    },
    updateGroup: async (id, data) => {
        return prisma.modifierGroup.update({
            where: { id },
            data
        });
    },
    deleteGroup: async (id) => {
        // Check if used by products
        const usage = await prisma.productModifierGroup.count({
            where: { modifierGroupId: id }
        });
        if (usage > 0) {
            throw new Error('Cannot delete group used by products');
        }
        // Delete options first (cascade usually handles this but explicit is safer to avoid orphans if cascade missing)
        await prisma.modifierOption.deleteMany({
            where: { modifierGroupId: id }
        });
        return prisma.modifierGroup.delete({
            where: { id }
        });
    },
    // Options Management
    addOption: async (groupId, data) => {
        return prisma.modifierOption.create({
            data: {
                modifierGroupId: groupId,
                name: data.name,
                priceOverlay: data.priceOverlay ?? 0,
                ingredientId: data.ingredientId ?? null,
                qtyUsed: data.qtyUsed ?? 1
            }
        });
    },
    updateOption: async (optionId, data) => {
        return prisma.modifierOption.update({
            where: { id: optionId },
            data: data
        });
    },
    deleteOption: async (optionId) => {
        // Check usage in orders? 
        // If used in historic orders, maybe soft delete? 
        // Current schema doesn't have soft delete for options.
        // For now hard delete, might break historic data if not cautious.
        // Ideally should be soft delete or blocked.
        // Assuming simple CRUD for now.
        return prisma.modifierOption.delete({
            where: { id: optionId }
        });
    }
};
//# sourceMappingURL=modifier.service.js.map