/**
 * @fileoverview Servicio de Grupos de Modificadores y Opciones
 *
 * Gestiona los grupos de modificadores (ej: "Punto de coccion", "Extras") y sus
 * opciones individuales (ej: "Bien cocido", "Queso extra"). Los modificadores
 * permiten personalizar productos en el punto de venta.
 *
 * Cada grupo define minSelection y maxSelection para controlar cuantas opciones
 * puede elegir el cliente (ej: min=1, max=1 para seleccion unica obligatoria).
 *
 * Las opciones pueden tener un precio adicional (priceOverlay) y opcionalmente
 * estar vinculadas a un ingrediente para descontar stock automaticamente.
 *
 * SEGURIDAD: Todas las operaciones verifican propiedad del tenant antes de modificar.
 * Se usa updateMany/deleteMany como defensa en profundidad para garantizar
 * que tenantId siempre este en la clausula WHERE.
 *
 * @module services/modifier.service
 */

import { prisma } from '../lib/prisma';
import { ModifierGroup, ModifierOption } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';

export interface CreateGroupInput {
  name: string;
  minSelection?: number | undefined;
  maxSelection?: number | undefined;
  tenantId: number;
}

export interface UpdateGroupInput {
  name?: string | undefined;
  minSelection?: number | undefined;
  maxSelection?: number | undefined;
}

export interface CreateOptionInput {
  name: string;
  priceOverlay?: number | undefined;
  ingredientId?: number | undefined;
  qtyUsed?: number | undefined;
}

export interface UpdateOptionInput {
  name?: string | undefined;
  priceOverlay?: number | undefined;
  ingredientId?: number | undefined;
  qtyUsed?: number | undefined;
}

export const modifierService = {
  /**
   * Obtiene todos los grupos de modificadores del tenant con paginacion.
   * Incluye las opciones de cada grupo y los productos asociados.
   */
  getAllGroups: async (tenantId: number, page: number = 1, limit: number = 50) => {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.modifierGroup.findMany({
        where: { tenantId },
        include: {
          options: {
              include: {
                  ingredient: true
              }
          },
          products: true
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      prisma.modifierGroup.count({ where: { tenantId } })
    ]);

    return {
      data,
      total,
      page,
      limit
    };
  },

  /**
   * Obtiene un grupo de modificadores por ID, verificando que pertenezca al tenant.
   * Incluye opciones con sus ingredientes vinculados.
   */
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

  /**
   * Crea un nuevo grupo de modificadores.
   * minSelection por defecto es 0 (opcional) y maxSelection es 1 (seleccion unica).
   */
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

  /**
   * Actualiza un grupo de modificadores existente.
   * Verifica propiedad del tenant antes de actualizar.
   * Construye el objeto de actualizacion explicitamente para satisfacer exactOptionalPropertyTypes.
   */
  updateGroup: async (id: number, tenantId: number, data: UpdateGroupInput) => {
    // Verificar propiedad del recurso
    const group = await prisma.modifierGroup.findFirst({ where: { id, tenantId } });
    if (!group) throw new NotFoundError('Modifier Group');

    // Defensa en profundidad: updateMany garantiza tenantId en la clausula WHERE.
    // Se construye el objeto explicitamente para satisfacer exactOptionalPropertyTypes de TypeScript.
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.minSelection !== undefined) updateData.minSelection = data.minSelection;
    if (data.maxSelection !== undefined) updateData.maxSelection = data.maxSelection;

    return prisma.modifierGroup.updateMany({
      where: { id, tenantId },
      data: updateData
    });
  },

  /**
   * Elimina un grupo de modificadores y todas sus opciones.
   * Verifica que no este siendo utilizado por ningun producto antes de eliminar.
   * Elimina opciones primero de forma explicita para evitar huerfanos si falta cascade.
   */
  deleteGroup: async (id: number, tenantId: number) => {
    // Verificar propiedad del recurso
    const group = await prisma.modifierGroup.findFirst({ where: { id, tenantId } });
    if (!group) throw new NotFoundError('Modifier Group');

    // Verificar si esta siendo utilizado por algun producto
    const usage = await prisma.productModifierGroup.count({
        where: { modifierGroupId: id, tenantId }
    });
    if (usage > 0) {
        throw new ConflictError('Cannot delete group used by products');
    }

    // Eliminar opciones primero (el cascade normalmente maneja esto, pero hacerlo explicito
    // es mas seguro para evitar opciones huerfanas si falta la configuracion de cascade)
    await prisma.modifierOption.deleteMany({
        where: { modifierGroupId: id, tenantId }
    });

    // Defensa en profundidad: deleteMany garantiza tenantId en la clausula WHERE
    return prisma.modifierGroup.deleteMany({
      where: { id, tenantId }
    });
  },

  // ============================================================================
  // GESTION DE OPCIONES
  // ============================================================================

  /**
   * Agrega una nueva opcion a un grupo de modificadores.
   * Verifica que el grupo pertenezca al tenant y valida que el precio no sea negativo.
   */
  addOption: async (groupId: number, tenantId: number, data: CreateOptionInput) => {
    // Verificar propiedad del grupo
    const group = await prisma.modifierGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new NotFoundError('Modifier Group');

    if (data.priceOverlay !== undefined && data.priceOverlay < 0) {
      throw new ValidationError('Modifier price cannot be negative');
    }

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

  /**
   * Actualiza una opcion de modificador existente.
   * Verifica propiedad via tenantId directamente en ModifierOption.
   * Usa updateMany como defensa en profundidad.
   */
  updateOption: async (optionId: number, tenantId: number, data: UpdateOptionInput) => {
    // Verificar propiedad de la opcion via tenantId en ModifierOption
    const option = await prisma.modifierOption.findFirst({
        where: { id: optionId, tenantId },
        include: { group: true }
    });

    if (!option) {
        throw new NotFoundError('Modifier Option');
    }

    if (data.priceOverlay !== undefined && data.priceOverlay < 0) {
      throw new ValidationError('Modifier price cannot be negative');
    }

    // Defensa en profundidad: updateMany garantiza tenantId en la clausula WHERE
    return prisma.modifierOption.updateMany({
      where: { id: optionId, tenantId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.priceOverlay !== undefined && { priceOverlay: data.priceOverlay }),
        ...(data.ingredientId !== undefined && { ingredientId: data.ingredientId }),
        ...(data.qtyUsed !== undefined && { qtyUsed: data.qtyUsed })
      }
    });
  },

  /**
   * Elimina una opcion de modificador.
   * Verifica propiedad via tenantId directamente en ModifierOption.
   * Usa deleteMany como defensa en profundidad.
   */
  deleteOption: async (optionId: number, tenantId: number) => {
    // Verificar propiedad de la opcion via tenantId en ModifierOption
    const option = await prisma.modifierOption.findFirst({
        where: { id: optionId, tenantId },
        include: { group: true }
    });

    if (!option) {
        throw new NotFoundError('Modifier Option');
    }

    // Defensa en profundidad: deleteMany garantiza tenantId en la clausula WHERE
    return prisma.modifierOption.deleteMany({
      where: { id: optionId, tenantId }
    });
  }
};
