import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';

export class SupplierService {
  /**
   * Get all active suppliers
   */
  async getAll() {
    return await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get supplier by ID
   */
  async getById(id: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });
    
    if (!supplier) throw new NotFoundError('Supplier');
    return supplier;
  }

  /**
   * Create new supplier
   */
  async create(data: Prisma.SupplierCreateInput) {
    // Validate unique name
    const existing = await prisma.supplier.findFirst({
      where: { 
        name: data.name,
        isActive: true 
      }
    });
    
    if (existing) {
      throw new ConflictError('Ya existe un proveedor activo con ese nombre');
    }
    
    return await prisma.supplier.create({ 
      data 
    });
  }

  /**
   * Update supplier
   */
  async update(id: number, data: Prisma.SupplierUpdateInput) {
    const supplier = await prisma.supplier.findUnique({ 
      where: { id } 
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
          id: { not: id }
        }
      });
      
      if (existing) {
        throw new ConflictError('Ya existe un proveedor con ese nombre');
      }
    }
    
    return await prisma.supplier.update({
      where: { id },
      data
    });
  }

  /**
   * Soft delete supplier
   * Validates that supplier has no purchase orders
   */
  async delete(id: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });
    
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }
    
    // Check if has purchase orders
    const ordersCount = await prisma.purchaseOrder.count({
      where: { supplierId: id }
    });
    
    if (ordersCount > 0) {
      throw new ConflictError(
        `No se puede eliminar: el proveedor tiene ${ordersCount} órdenes de compra`
      );
    }
    
    // Soft delete
    return await prisma.supplier.update({
      where: { id },
      data: { isActive: false }
    });
  }
}

export const supplierService = new SupplierService();
