
import { PrismaClient, Ingredient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export class IngredientService {
  
  async getAll(tenantId: number, page = 1, limit = 200) {
    const take = Math.min(limit, 500);
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      prisma.ingredient.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        skip,
        take
      }),
      prisma.ingredient.count({ where: { tenantId } })
    ]);

    return { data, total, page, limit: take };
  }

  async getById(id: number, tenantId: number) {
    return await prisma.ingredient.findFirst({
      where: { id, tenantId }
    });
  }

  async create(tenantId: number, data: { name: string; unit: string; cost: number; stock: number; minStock?: number }) {
    return await prisma.ingredient.create({
      data: {
        tenantId,
        name: data.name,
        unit: data.unit,
        cost: data.cost,
        stock: data.stock,
        minStock: data.minStock || 0
      }
    });
  }

  async update(id: number, tenantId: number, data: { name?: string; unit?: string; cost?: number; minStock?: number; stock?: number }) {
    // Verify ownership
    const exists = await prisma.ingredient.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Ingredient');

    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return await prisma.ingredient.updateMany({
      where: { id, tenantId },
      data
    });
  }

  async delete(id: number, tenantId: number) {
    // Verify ownership
    const exists = await prisma.ingredient.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Ingredient');

    // Check if used in any product or modifier
    const usageCount = await prisma.productIngredient.count({ where: { ingredientId: id, tenantId } });
    if (usageCount > 0) {
      throw new ConflictError('Cannot delete ingredient used by products');
    }
    
    // defense-in-depth: deleteMany ensures tenantId is in the WHERE clause
    return await prisma.ingredient.deleteMany({
      where: { id, tenantId }
    });
  }
}
