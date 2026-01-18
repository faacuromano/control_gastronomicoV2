import { PrismaClient, ModifierGroup, ModifierOption } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateGroupInput {
  name: string;
  minSelection?: number;
  maxSelection?: number;
}

export interface UpdateGroupInput {
  name?: string;
  minSelection?: number;
  maxSelection?: number;
}

export interface CreateOptionInput {
  name: string;
  priceOverlay?: number;
  ingredientId?: number;
  qtyUsed?: number;
}

export interface UpdateOptionInput {
  name?: string;
  priceOverlay?: number;
  ingredientId?: number;
  qtyUsed?: number;
}

export const modifierService = {
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

  getGroupById: async (id: number) => {
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

  createGroup: async (data: CreateGroupInput) => {
    return prisma.modifierGroup.create({
      data: {
        name: data.name,
        minSelection: data.minSelection ?? 0,
        maxSelection: data.maxSelection ?? 1
      }
    });
  },

  updateGroup: async (id: number, data: UpdateGroupInput) => {
    return prisma.modifierGroup.update({
      where: { id },
      data
    });
  },

  deleteGroup: async (id: number) => {
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
  addOption: async (groupId: number, data: CreateOptionInput) => {
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

  updateOption: async (optionId: number, data: UpdateOptionInput) => {
    return prisma.modifierOption.update({
      where: { id: optionId },
      data: data as any
    });
  },

  deleteOption: async (optionId: number) => {
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
