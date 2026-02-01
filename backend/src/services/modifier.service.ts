import { prisma } from '../lib/prisma';
import { ModifierGroup, ModifierOption } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';

export interface CreateGroupInput {
  name: string;
  minSelection?: number;
  maxSelection?: number;
  tenantId: number;
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
  getAllGroups: async (tenantId: number) => {
    return prisma.modifierGroup.findMany({
      where: { tenantId },
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

  getGroupById: async (id: number, tenantId: number) => {
    return prisma.modifierGroup.findFirst({
      where: { id, tenantId },
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
        tenantId: data.tenantId,
        name: data.name,
        minSelection: data.minSelection ?? 0,
        maxSelection: data.maxSelection ?? 1
      }
    });
  },

  updateGroup: async (id: number, tenantId: number, data: UpdateGroupInput) => {
    // Verify ownership
    const group = await prisma.modifierGroup.findFirst({ where: { id, tenantId } });
    if (!group) throw new NotFoundError('Modifier Group');

    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return prisma.modifierGroup.updateMany({
      where: { id, tenantId },
      data
    });
  },

  deleteGroup: async (id: number, tenantId: number) => {
    // Verify ownership
    const group = await prisma.modifierGroup.findFirst({ where: { id, tenantId } });
    if (!group) throw new NotFoundError('Modifier Group');

    // Check if used by products
    const usage = await prisma.productModifierGroup.count({
        where: { modifierGroupId: id, tenantId }
    });
    if (usage > 0) {
        throw new ConflictError('Cannot delete group used by products');
    }

    // Delete options first (cascade usually handles this but explicit is safer to avoid orphans if cascade missing)
    await prisma.modifierOption.deleteMany({
        where: { modifierGroupId: id, tenantId }
    });

    // defense-in-depth: deleteMany ensures tenantId is in the WHERE clause
    return prisma.modifierGroup.deleteMany({
      where: { id, tenantId }
    });
  },

  // Options Management
  addOption: async (groupId: number, tenantId: number, data: CreateOptionInput) => {
    // Verify Group Ownership
    const group = await prisma.modifierGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new NotFoundError('Modifier Group');

    return prisma.modifierOption.create({
      data: {
        tenantId,
        modifierGroupId: groupId,
        name: data.name,
        priceOverlay: data.priceOverlay ?? 0,
        ingredientId: data.ingredientId ?? null,
        qtyUsed: data.qtyUsed ?? 1
      }
    });
  },

  updateOption: async (optionId: number, tenantId: number, data: UpdateOptionInput) => {
    // Verify Option Ownership via tenantId on ModifierOption
    const option = await prisma.modifierOption.findFirst({
        where: { id: optionId, tenantId },
        include: { group: true }
    });

    if (!option) {
        throw new NotFoundError('Modifier Option');
    }

    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return prisma.modifierOption.updateMany({
      where: { id: optionId, tenantId },
      data: data as any
    });
  },

  deleteOption: async (optionId: number, tenantId: number) => {
    // Verify Option Ownership via tenantId on ModifierOption
    const option = await prisma.modifierOption.findFirst({
        where: { id: optionId, tenantId },
        include: { group: true }
    });

    if (!option) {
        throw new NotFoundError('Modifier Option');
    }

    // defense-in-depth: deleteMany ensures tenantId is in the WHERE clause
    return prisma.modifierOption.deleteMany({
      where: { id: optionId, tenantId }
    });
  }
};
