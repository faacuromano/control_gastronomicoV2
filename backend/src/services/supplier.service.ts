import { prisma } from '../lib/prisma';
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
  async create(tenantId: number, data: { name: string; phone?: string | undefined; email?: string | undefined; address?: string | undefined; taxId?: string | undefined }) {
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
   * Update supplier
   */
  async update(id: number, tenantId: number, data: { name?: string | undefined; phone?: string | undefined; email?: string | undefined; address?: string | undefined; taxId?: string | undefined }) {
    // DB-011: Wrap check+update in transaction to prevent TOCTOU race
    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id, tenantId }
      });

      if (!supplier) {
        throw new NotFoundError('Supplier');
      }

      // If updating name, check uniqueness inside transaction
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

      // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
      // Build update data explicitly to satisfy exactOptionalPropertyTypes
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
        `Cannot delete: supplier has ${ordersCount} purchase orders`
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
