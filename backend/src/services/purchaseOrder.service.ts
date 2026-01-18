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
  async getAll(status?: PurchaseStatus) {
    const whereClause = status ? { status } : {};
    
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
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get purchase order by ID with all details
   */
  async getById(id: number) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
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
   * Generate next order number
   */
  private async getNextOrderNumber(): Promise<number> {
    const lastOrder = await prisma.purchaseOrder.findFirst({
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true }
    });
    return (lastOrder?.orderNumber ?? 0) + 1;
  }

  /**
   * Create a new purchase order
   */
  async create(data: CreatePurchaseOrderInput) {
    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId }
    });
    if (!supplier || !supplier.isActive) {
      throw new NotFoundError('Supplier');
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('La orden debe tener al menos un item');
    }

    // Validate all ingredients exist
    const ingredientIds = data.items.map(i => i.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds } }
    });
    if (ingredients.length !== ingredientIds.length) {
      throw new ValidationError('Uno o más ingredientes no existen');
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of data.items) {
      subtotal += item.quantity * item.unitCost;
    }

    const orderNumber = await this.getNextOrderNumber();

    return await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        status: 'PENDING',
        subtotal,
        total: subtotal, // No taxes for now
        notes: data.notes ?? null,
        items: {
          create: data.items.map(item => ({
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
  }

  /**
   * Update purchase order status
   */
  async updateStatus(id: number, status: PurchaseStatus) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status === 'RECEIVED') {
      throw new ConflictError('No se puede modificar una orden ya recibida');
    }

    if (order.status === 'CANCELLED') {
      throw new ConflictError('No se puede modificar una orden cancelada');
    }

    return await prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    });
  }

  /**
   * Receive purchase order - updates stock
   */
  async receivePurchaseOrder(id: number) {
    return await prisma.$transaction(async (tx) => {
      // 1. Get order with items
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
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
          StockMoveType.PURCHASE,
          Number(item.quantity),
          `Orden de Compra #${order.orderNumber}`,
          tx
        );
      }

      // 3. Mark as received
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
  async cancel(id: number) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status === 'RECEIVED') {
      throw new ConflictError('No se puede cancelar una orden ya recibida');
    }

    return await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
  }

  /**
   * Delete purchase order (only if PENDING)
   */
  async delete(id: number) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status !== 'PENDING') {
      throw new ConflictError('Solo se pueden eliminar órdenes pendientes');
    }

    await prisma.purchaseOrder.delete({
      where: { id }
    });
  }
}

export const purchaseOrderService = new PurchaseOrderService();
