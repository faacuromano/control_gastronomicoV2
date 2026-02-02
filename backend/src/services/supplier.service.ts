/**
 * @fileoverview Servicio de gestion de proveedores.
 * Maneja el CRUD de proveedores con validaciones de unicidad por nombre,
 * proteccion contra eliminacion de proveedores con ordenes de compra asociadas,
 * y soft delete para preservar integridad referencial.
 *
 * @module services/supplier.service
 */

import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export class SupplierService {
  /**
   * Obtiene todos los proveedores activos con paginacion.
   * Solo retorna proveedores activos (no eliminados logicamente).
   */
  async getAll(tenantId: number, page = 1, limit = 200) {
    const take = Math.min(limit, 500);
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where: { isActive: true, tenantId },
        orderBy: { name: 'asc' },
        skip,
        take
      }),
      prisma.supplier.count({ where: { isActive: true, tenantId } })
    ]);

    return { data, total, page, limit: take };
  }

  /**
   * Obtiene un proveedor por su ID.
   */
  async getById(id: number, tenantId: number) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId }
    });

    if (!supplier) throw new NotFoundError('Supplier');
    return supplier;
  }

  /**
   * Crea un nuevo proveedor.
   * P1-21: Envuelve la verificacion de unicidad + creacion en una transaccion
   * para prevenir condiciones de carrera TOCTOU (Time-of-Check-Time-of-Use).
   */
  async create(tenantId: number, data: { name: string; phone?: string | undefined; email?: string | undefined; address?: string | undefined; taxId?: string | undefined }) {
    // P1-21: Transaccion para prevenir TOCTOU en la verificacion de nombre unico
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({
        where: {
          name: data.name,
          isActive: true,
          tenantId
        }
      });

      if (existing) {
        throw new ConflictError('An active supplier with that name already exists');
      }

      return await tx.supplier.create({
        data: {
          tenantId,
          name: data.name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          taxId: data.taxId ?? null
        }
      });
    });
  }

  /**
   * Actualiza un proveedor existente.
   * DB-011: Envuelve la verificacion + actualizacion en transaccion para prevenir TOCTOU.
   * Si se cambia el nombre, verifica que no exista otro proveedor activo con ese nombre.
   */
  async update(id: number, tenantId: number, data: { name?: string | undefined; phone?: string | undefined; email?: string | undefined; address?: string | undefined; taxId?: string | undefined }) {
    // DB-011: Transaccion para prevenir TOCTOU en la verificacion de nombre unico
    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id, tenantId }
      });

      if (!supplier) {
        throw new NotFoundError('Supplier');
      }

      // Si se esta actualizando el nombre, verificar unicidad dentro de la transaccion
      if (data.name && data.name !== supplier.name) {
        const existing = await tx.supplier.findFirst({
          where: {
            name: data.name,
            isActive: true,
            tenantId,
            id: { not: id }
          }
        });

        if (existing) {
          throw new ConflictError('A supplier with that name already exists');
        }
      }

      // Defensa en profundidad: updateMany garantiza que tenantId este en la clausula WHERE
      // Construir datos de actualizacion explicitamente para satisfacer exactOptionalPropertyTypes
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.taxId !== undefined) updateData.taxId = data.taxId;

      return await tx.supplier.updateMany({
        where: { id, tenantId },
        data: updateData
      });
    });
  }

  /**
   * Eliminacion logica (soft delete) de un proveedor.
   * Valida que el proveedor no tenga ordenes de compra asociadas antes de eliminarlo,
   * ya que las ordenes necesitan la referencia al proveedor para reportes historicos.
   */
  async delete(id: number, tenantId: number) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId }
    });

    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    // Verificar si tiene ordenes de compra asociadas
    const ordersCount = await prisma.purchaseOrder.count({
      where: { supplierId: id, tenantId }
    });

    if (ordersCount > 0) {
      throw new ConflictError(
        `Cannot delete: supplier has ${ordersCount} purchase orders`
      );
    }

    // Soft delete: defensa en profundidad con updateMany que incluye tenantId en WHERE
    return await prisma.supplier.updateMany({
      where: { id, tenantId },
      data: { isActive: false }
    });
  }
}

export const supplierService = new SupplierService();
