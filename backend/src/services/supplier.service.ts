import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';

export class SupplierService {
  /**
   * Get all active suppliers
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
   * Get supplier by ID
   */
  async getById(id: number, tenantId: number) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId }
    });
    
    if (!supplier) throw new NotFoundError('Supplier');
    return supplier;
  }

  /**
   * Create new supplier
   */
  async create(tenantId: number, data: Prisma.SupplierCreateInput) {
    // P1-21: Wrap check+create in transaction to prevent TOCTOU race
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({
        where: {
          name: data.name,
          isActive: true,
          tenantId
        }
      });

      if (existing) {
        throw new ConflictError('Ya existe un proveedor activo con ese nombre');
      }

      return await tx.supplier.create({
        data: {
          ...(data as any),
          tenantId
        }
      });
    });
  }

  /**
   * Update supplier
   */
  async update(id: number, tenantId: number, data: Prisma.SupplierUpdateInput) {
    const supplier = await prisma.supplier.findFirst({ 
      where: { id, tenantId } 
    });
    
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }
    
    // If updating name, check uniqueness
    if (data.name && typeof data.name === 'string' && data.name !== supplier.name) {
      const existing = await prisma.supplier.findFirst({
        where: { 
          name: data.name,
          isActive: true,
          tenantId,
          id: { not: id }
        }
      });
      
      if (existing) {
        throw new ConflictError('Ya existe un proveedor con ese nombre');
      }
    }
    
    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return await prisma.supplier.updateMany({
      where: { id, tenantId },
      data: data as any
    });
  }

  /**
   * Soft delete supplier
   * Validates that supplier has no purchase orders
   */
  async delete(id: number, tenantId: number) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId }
    });
    
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }
    
    // Check if has purchase orders
    const ordersCount = await prisma.purchaseOrder.count({
      where: { supplierId: id, tenantId }
    });
    
    if (ordersCount > 0) {
      throw new ConflictError(
        `No se puede eliminar: el proveedor tiene ${ordersCount} órdenes de compra`
      );
    }
    
    // Soft delete — defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return await prisma.supplier.updateMany({
      where: { id, tenantId },
      data: { isActive: false }
    });
  }
}

export const supplierService = new SupplierService();
