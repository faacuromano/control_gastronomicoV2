
import { PrismaClient, Ingredient } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class IngredientService {
  
  async getAll() {
    return await prisma.ingredient.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async getById(id: number) {
    return await prisma.ingredient.findUnique({
      where: { id }
    });
  }

  async create(data: { name: string; unit: string; cost: number; stock: number; minStock?: number }) {
    return await prisma.ingredient.create({
      data: {
        name: data.name,
        unit: data.unit,
        cost: data.cost,
        stock: data.stock,
        minStock: data.minStock || 0
      }
    });
  }

  async update(id: number, data: { name?: string; unit?: string; cost?: number; minStock?: number; stock?: number }) {
    return await prisma.ingredient.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    // Check if used in any product or modifier
    const usageCount = await prisma.productIngredient.count({ where: { ingredientId: id } });
    if (usageCount > 0) {
      throw new Error('Cannot delete ingredient used in products.');
    }
    
    return await prisma.ingredient.delete({
      where: { id }
    });
  }
}
