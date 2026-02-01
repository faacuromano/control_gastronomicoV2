import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, PurchaseStatus } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { StockMovementService } from './stockMovement.service';

const stockService = new StockMovementService();

interface CreatePurchaseOrderInput {
  supplierId: number;
  notes?: string;
  items: {
    ingredientId: number;
    quantity: number;
    unitCost: number;
  }[];
}

export class PurchaseOrderService {
  /**
   * Get all purchase orders with supplier info
   */
  async getAll(tenantId: number, status?: PurchaseStatus) {
    const whereClause: any = { tenantId };
    if (status) whereClause.status = status;
    
    return await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  /**
   * Get purchase order by ID with all details
   */
  async getById(id: number, tenantId: number) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true }
            }
          }
        }
      }
    });

    if (!order) throw new NotFoundError('Purchase Order');
    return order;
  }

  /**
   * Create a new purchase order
   * Uses transaction with retry logic to handle race conditions on order number generation
   */
  async create(tenantId: number, data: CreatePurchaseOrderInput) {
    // Validate supplier exists (outside transaction - read-only, safe)
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, tenantId }
    });
    if (!supplier || !supplier.isActive) {
      throw new NotFoundError('Supplier');
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('La orden debe tener al menos un item');
    }

    // Validate all ingredients exist (outside transaction - read-only, safe)
    const ingredientIds = data.items.map(i => i.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId }
    });
    if (ingredients.length !== ingredientIds.length) {
      throw new ValidationError('Uno o más ingredientes no existen');
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of data.items) {
      subtotal += item.quantity * item.unitCost;
    }

    // Retry loop for race condition on order number
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Generate order number INSIDE transaction to prevent race conditions
          const lastOrder = await tx.purchaseOrder.findFirst({
            where: { tenantId },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true }
          });
          const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

          return await tx.purchaseOrder.create({
            data: {
              tenantId,
              orderNumber,
              supplierId: data.supplierId,
              status: 'PENDING',
              subtotal,
              total: subtotal, // No taxes for now
              notes: data.notes ?? null,
              items: {
                create: data.items.map(item => ({
                  tenantId,
                  ingredientId: item.ingredientId,
                  quantity: item.quantity,
                  unitCost: item.unitCost
                }))
              }
            },
            include: {
              supplier: true,
              items: {
                include: {
                  ingredient: true
                }
              }
            }
          });
        });
      } catch (error: any) {
        // Retry on unique constraint violation (P2002) for orderNumber
        if (error.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to create purchase order after maximum retries');
  }

  /**
   * Update purchase order status
   */
  async updateStatus(id: number, tenantId: number, status: PurchaseStatus) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status === 'RECEIVED') {
      throw new ConflictError('No se puede modificar una orden ya recibida');
    }

    if (order.status === 'CANCELLED') {
      throw new ConflictError('No se puede modificar una orden cancelada');
    }

    return await prisma.purchaseOrder.updateMany({
      where: { id, tenantId },
      data: { status }
    });
  }

  /**
   * Receive purchase order - updates stock
   */
  async receivePurchaseOrder(id: number, tenantId: number) {
    return await prisma.$transaction(async (tx) => {
      // 1. Get order with items
      const order = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { 
          items: {
            include: {
              ingredient: true
            }
          }
        }
      });

      if (!order) throw new NotFoundError('Purchase Order');

      if (order.status === 'RECEIVED') {
        throw new ConflictError('La orden ya fue recibida');
      }

      if (order.status === 'CANCELLED') {
        throw new ConflictError('No se puede recibir una orden cancelada');
      }

      // 2. Create stock movements for each item
      for (const item of order.items) {
        await stockService.register(
          item.ingredientId,
          tenantId,
          StockMoveType.PURCHASE,
          Number(item.quantity),
          `Orden de Compra #${order.orderNumber}`,
          tx
        );
      }

      // 3. Mark as received
      // SAFE: tx.findFirst L177 verifies tenant ownership
      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date()
        },
        include: {
          supplier: true,
          items: {
            include: {
              ingredient: true
            }
          }
        }
      });
    });
  }

  /**
   * Cancel purchase order
   */
  async cancel(id: number, tenantId: number) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status === 'RECEIVED') {
      throw new ConflictError('No se puede cancelar una orden ya recibida');
    }

    return await prisma.purchaseOrder.updateMany({
      where: { id, tenantId },
      data: { status: 'CANCELLED' }
    });
  }

  /**
   * Delete purchase order (only if PENDING)
   */
  async delete(id: number, tenantId: number) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status !== 'PENDING') {
      throw new ConflictError('Solo se pueden eliminar órdenes pendientes');
    }

    await prisma.purchaseOrder.deleteMany({
      where: { id, tenantId }
    });
  }
}

export const purchaseOrderService = new PurchaseOrderService();
