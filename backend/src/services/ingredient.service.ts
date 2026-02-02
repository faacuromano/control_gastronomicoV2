/**
 * @fileoverview Servicio de Ingredientes
 *
 * CRUD completo para ingredientes del inventario del restaurante.
 * Cada ingrediente pertenece a un tenant y puede estar vinculado a productos
 * a traves de la tabla intermedia ProductIngredient.
 *
 * Todas las operaciones estan aisladas por tenantId para garantizar
 * la seguridad multi-tenant.
 *
 * @module services/ingredient.service
 */

import { PrismaClient, Ingredient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export class IngredientService {

  /**
   * Obtiene todos los ingredientes del tenant con paginacion.
   * El limite maximo por pagina es 500 para evitar respuestas excesivamente grandes.
   */
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

  /**
   * Obtiene un ingrediente por su ID, verificando que pertenezca al tenant.
   */
  async getById(id: number, tenantId: number) {
    return await prisma.ingredient.findFirst({
      where: { id, tenantId }
    });
  }

  /**
   * Crea un nuevo ingrediente asociado al tenant.
   * El stock minimo (minStock) por defecto es 0 si no se especifica.
   */
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

  /**
   * Actualiza un ingrediente existente.
   * Primero verifica que el ingrediente pertenezca al tenant (ownership check).
   * Usa updateMany como defensa en profundidad para asegurar que tenantId
   * siempre este en la clausula WHERE.
   */
  async update(id: number, tenantId: number, data: { name?: string; unit?: string; cost?: number; minStock?: number; stock?: number }) {
    // Verificar propiedad del recurso
    const exists = await prisma.ingredient.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Ingredient');

    // Defensa en profundidad: updateMany garantiza tenantId en la clausula WHERE
    return await prisma.ingredient.updateMany({
      where: { id, tenantId },
      data
    });
  }

  /**
   * Elimina un ingrediente del tenant.
   * Verifica primero que no este siendo utilizado por ningun producto,
   * ya que eso causaria inconsistencia en las recetas.
   * Usa deleteMany como defensa en profundidad.
   */
  async delete(id: number, tenantId: number) {
    // Verificar propiedad del recurso
    const exists = await prisma.ingredient.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Ingredient');

    // Verificar si esta siendo utilizado en algun producto o modificador
    const usageCount = await prisma.productIngredient.count({ where: { ingredientId: id, tenantId } });
    if (usageCount > 0) {
      throw new ConflictError('Cannot delete ingredient used by products');
    }

    // Defensa en profundidad: deleteMany garantiza tenantId en la clausula WHERE
    return await prisma.ingredient.deleteMany({
      where: { id, tenantId }
    });
  }
}
