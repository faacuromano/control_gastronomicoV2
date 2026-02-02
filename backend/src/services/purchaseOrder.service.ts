/**
 * @fileoverview Servicio de ordenes de compra a proveedores.
 * Gestiona el ciclo de vida completo de las ordenes de compra:
 * creacion, cambio de estado, recepcion (con actualizacion de stock)
 * y cancelacion. Incluye logica de reintento para generacion atomica
 * de numeros de orden.
 *
 * @module services/purchaseOrder.service
 */

import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, PurchaseStatus } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { StockMovementService } from './stockMovement.service';

const stockService = new StockMovementService();

/**
 * Estructura de entrada para crear una orden de compra.
 * Incluye proveedor, notas opcionales y lista de items con ingrediente, cantidad y costo.
 */
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
   * Obtiene todas las ordenes de compra con informacion del proveedor.
   * Opcionalmente filtra por estado (PENDING, ORDERED, RECEIVED, etc.).
   */
  async getAll(tenantId: number, status?: PurchaseStatus) {
    const whereClause: { tenantId: number; status?: PurchaseStatus } = { tenantId };
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
   * Obtiene una orden de compra por ID con todos sus detalles e items.
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
   * Crea una nueva orden de compra.
   *
   * Usa transaccion con logica de reintento para manejar condiciones de carrera
   * en la generacion del numero de orden. Si dos ordenes se crean simultaneamente,
   * el numero secuencial podria colisionar (P2002: unique constraint violation),
   * en cuyo caso se reintenta hasta 3 veces.
   *
   * Validaciones:
   * - Proveedor existe y esta activo
   * - Al menos un item en la orden
   * - Todos los ingredientes existen en el tenant
   * - Cantidades dentro de limites razonables
   */
  async create(tenantId: number, data: CreatePurchaseOrderInput) {
    // Validar proveedor (fuera de transaccion: solo lectura, seguro)
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, tenantId }
    });
    if (!supplier || !supplier.isActive) {
      throw new NotFoundError('Supplier');
    }

    // Validar que haya al menos un item
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    // Validar que todos los ingredientes existan (fuera de transaccion: solo lectura, seguro)
    const ingredientIds = data.items.map(i => i.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId }
    });
    if (ingredients.length !== ingredientIds.length) {
      throw new ValidationError('One or more ingredients do not exist');
    }

    // Validar limites de cantidad y costo por item
    const MAX_ITEM_QUANTITY = 100000;
    for (const item of data.items) {
      if (item.quantity <= 0 || item.quantity > MAX_ITEM_QUANTITY) {
        throw new ValidationError(`Item quantity must be between 1 and ${MAX_ITEM_QUANTITY}`);
      }
      if (item.unitCost < 0) {
        throw new ValidationError('Unit cost cannot be negative');
      }
    }

    // Calcular subtotal sumando cantidad * costo unitario de cada item
    let subtotal = 0;
    for (const item of data.items) {
      subtotal += item.quantity * item.unitCost;
    }

    // Bucle de reintento para condiciones de carrera en el numero de orden
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Generar numero de orden DENTRO de la transaccion para prevenir condiciones de carrera
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
              total: subtotal, // Sin impuestos por ahora
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
      } catch (error: unknown) {
        // Reintentar en caso de violacion de constraint unico (P2002) por numero de orden
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictError('Failed to create purchase order after maximum retries');
  }

  /**
   * Actualiza el estado de una orden de compra.
   * No permite modificar ordenes ya recibidas o canceladas (estados terminales).
   */
  async updateStatus(id: number, tenantId: number, status: PurchaseStatus) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status === 'RECEIVED') {
      throw new ConflictError('Cannot modify a received order');
    }

    if (order.status === 'CANCELLED') {
      throw new ConflictError('Cannot modify a cancelled order');
    }

    return await prisma.purchaseOrder.updateMany({
      where: { id, tenantId },
      data: { status }
    });
  }

  /**
   * Recibe una orden de compra: actualiza el stock de cada ingrediente.
   *
   * Flujo dentro de una transaccion atomica:
   * 1. Obtiene la orden con sus items
   * 2. Valida que no este ya recibida o cancelada
   * 3. Registra movimientos de stock tipo PURCHASE para cada ingrediente
   * 4. Marca la orden como RECEIVED con la fecha actual
   *
   * PERF-011: Usa registerBatch en vez de N llamadas individuales a register()
   */
  async receivePurchaseOrder(id: number, tenantId: number) {
    return await prisma.$transaction(async (tx) => {
      // 1. Obtener orden con items e ingredientes
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
        throw new ConflictError('Order has already been received');
      }

      if (order.status === 'CANCELLED') {
        throw new ConflictError('Cannot receive a cancelled order');
      }

      // 2. Crear movimientos de stock para cada item (incrementa inventario)
      // PERF-011: Usar registerBatch en vez de N llamadas individuales a register()
      const stockUpdates = order.items.map(item => ({
        ingredientId: item.ingredientId,
        quantity: Number(item.quantity)
      }));
      await stockService.registerBatch(
        stockUpdates,
        tenantId,
        StockMoveType.PURCHASE,
        `Purchase Order #${order.orderNumber}`,
        tx
      );

      // 3. Marcar como recibida con fecha de recepcion
      // SEGURO: tx.findFirst en L177 verifica propiedad del tenant
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
   * Cancela una orden de compra.
   * Solo se pueden cancelar ordenes que no hayan sido recibidas.
   */
  async cancel(id: number, tenantId: number) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status === 'RECEIVED') {
      throw new ConflictError('Cannot cancel a received order');
    }

    return await prisma.purchaseOrder.updateMany({
      where: { id, tenantId },
      data: { status: 'CANCELLED' }
    });
  }

  /**
   * Elimina una orden de compra (solo si esta en estado PENDING).
   * Ordenes en cualquier otro estado no pueden eliminarse, solo cancelarse.
   */
  async delete(id: number, tenantId: number) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) throw new NotFoundError('Purchase Order');

    if (order.status !== 'PENDING') {
      throw new ConflictError('Only pending orders can be deleted');
    }

    await prisma.purchaseOrder.deleteMany({
      where: { id, tenantId }
    });
  }
}

export const purchaseOrderService = new PurchaseOrderService();
