/**
 * @fileoverview Order management service.
 * Handles order creation, updates, and lifecycle management.
 * 
 * @module services/order.service
 * @adheres Single Responsibility - Order entity operations only
 * @dependencies OrderNumberService, PaymentService, StockMovementService
 */

import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, OrderChannel, PaymentMethod, OrderStatus, PaymentStatus } from '@prisma/client';
import { StockMovementService } from './stockMovement.service';
import { orderNumberService } from './orderNumber.service';
import { paymentService, PaymentInput } from './payment.service';
import { kdsService } from './kds.service';
import { executeIfEnabled } from './featureFlags.service';

const stockService = new StockMovementService();

/**
 * Input for a single order item.
 */
export interface OrderItemInput {
  productId: number;
  quantity: number;
  notes?: string;
}

/**
 * Input for delivery details.
 */
export interface DeliveryData {
    address: string;
    notes?: string;
    phone: string;
    name: string;
    driverId?: number;
}

/**
 * Input for creating a new order.
 * Supports both legacy single payment and split payments.
 */
export interface CreateOrderInput {
  userId: number;
  items: {
    productId: number;
    quantity: number;
    notes?: string;
    modifiers?: { id: number; price: number }[];
  }[];
  channel?: OrderChannel;
  tableId?: number;
  clientId?: number;
  serverId?: number;
  deliveryData?: DeliveryData;
  paymentMethod?: PaymentMethod | 'SPLIT';
  payments?: { method: string; amount: number }[];
}

// ... helper interfaces ...

/**
 * Internal structure for order item data before insertion.
 */
interface OrderItemData {
  productId: number;
  quantity: number;
  unitPrice: number;
  notes?: string | undefined;
  status: string;
}

/**
 * Internal structure for stock updates.
 */
interface StockUpdate {
  ingredientId: number;
  quantity: number;
}

/**
 * Prisma order creation data structure.
 */
interface OrderCreateData {
  orderNumber: number;
  channel: OrderChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  total: number;
  businessDate: Date;
  tableId?: number | undefined;
  clientId?: number | undefined;
  serverId?: number | undefined;
  driverId?: number | undefined;
  deliveryAddress?: string | undefined;
  deliveryNotes?: string | undefined;
  closedAt?: Date | undefined;
  items: {
    create: {
      product: { connect: { id: number } };
      quantity: number;
      unitPrice: number;
      notes: string | null;
      status: string;
    }[];
  };
  payments?: {
    create: {
      amount: number;
      method: PaymentMethod;
      shiftId: number;
    }[];
  } | undefined;
}

export class OrderService {
  
  /**
   * Get order by ID with full relations
   */
  async getById(id: number) {
      return await prisma.order.findUnique({
          where: { id },
          include: {
              items: { include: { product: true } },
              payments: true,
              client: true,
              driver: true
          }
      });
  }

  /**
   * Create a new order with items and optional payments.
   */
  async createOrder(data: CreateOrderInput) {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Validate Products & Calculate Totals
      const { itemDataList, stockUpdates, subtotal } = await this.validateAndCalculateItems(
        tx,
        data.items
      );

      const total = subtotal; // Apply discounts here if needed

      // 2. Generate order number
      const orderNumber = await orderNumberService.getNextOrderNumber(tx);

      // 3. Validate active shift
      if (!data.serverId) {
        throw new Error('Server ID is required to create an order');
      }

      const activeShift = await tx.cashShift.findFirst({
        where: { userId: data.serverId, endTime: null }
      });

      if (!activeShift) {
        throw new Error('NO_OPEN_SHIFT: Debes abrir un turno de caja antes de vender.');
      }

      // 4. Process payments
      const singlePaymentMethod = data.paymentMethod === 'SPLIT' ? undefined : (data.paymentMethod as PaymentMethod);
      
      const splitPayments = data.payments?.map(p => ({
        ...p,
        method: p.method as PaymentMethod
      }));

      const paymentResult = paymentService.processPayments(
        total,
        activeShift.id,
        singlePaymentMethod,
        splitPayments
      );

      // 5. Build order create data
      const createData: OrderCreateData = {
        orderNumber,
        channel: data.channel ?? 'POS',
        status: paymentResult.isFullyPaid ? 'CONFIRMED' : 'OPEN',
        paymentStatus: paymentResult.paymentStatus,
        subtotal,
        total,
        businessDate: new Date(),
        items: {
          create: itemDataList.map(item => ({
            product: { connect: { id: item.productId } },
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes ?? null,
            status: 'PENDING'
          }))
        }
      };

      // Add optional fields
      if (data.tableId) createData.tableId = data.tableId;
      if (data.clientId) createData.clientId = data.clientId;
      if (data.serverId) createData.serverId = data.serverId;
      if (paymentResult.isFullyPaid) createData.closedAt = new Date();
      
      // Delivery Fields
      if (data.deliveryData) {
          (createData as any).deliveryAddress = data.deliveryData.address;
          (createData as any).deliveryNotes = data.deliveryData.notes;
          if (data.deliveryData.driverId) {
             (createData as any).driverId = data.deliveryData.driverId;
          }
      }

      // Add payments if any
      if (paymentResult.paymentsToCreate.length > 0) {
        createData.payments = { create: paymentResult.paymentsToCreate };
      }

      // 6. Create order
      const order = await tx.order.create({
        data: createData as Parameters<typeof tx.order.create>[0]['data'],
        include: { items: true }
      });

      // 7. Update Stock
      await this.processStockUpdates(tx, stockUpdates);

      // 8. Update Table Status
      if (data.tableId) {
        await tx.table.update({
          where: { id: data.tableId },
          data: { status: 'OCCUPIED', currentOrderId: order.id }
        });
      }

      return order;
    });

    // 9. Broadcast to KDS (Outside transaction)
    if (order.status === 'CONFIRMED' || order.status === 'OPEN') {
        kdsService.broadcastNewOrder(order);
    }

    return order;
  }

  /**
   * Assign a driver to an order
   */
  async assignDriver(orderId: number, driverId: number) {
      const order = await prisma.order.update({
          where: { id: orderId },
          data: { 
              driverId,
              status: 'ON_ROUTE' as any // Force cast if type update lags
          },
          include: { driver: true }
      });
      
      // Broadcast update
      kdsService.broadcastOrderUpdate(order);
      
      return order;
  }

  /**
 * Get active delivery orders (including delivered orders from today)
 */
async getDeliveryOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.order.findMany({
        where: {
            deliveryAddress: { not: null },
            OR: [
                // Active orders (any status except DELIVERED/CANCELLED/CLOSED)
                {
                    status: { in: ['OPEN', 'CONFIRMED', 'PREPARED', 'ON_ROUTE' as any] }
                },
                // Delivered orders from today
                {
                    status: 'DELIVERED' as any,
                    closedAt: { gte: today }
                }
            ]
        },
        include: {
            items: { include: { product: true } },
            client: true,
            driver: true
        },
        orderBy: { createdAt: 'asc' }
    });
}

  /**
   * Update individual order item status
   */
  async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED') {
      const item = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status },
          include: { order: true } // Need orderId to broadcast
      });

      // Broadcast update via KDS (Using order update event for now, or specific item event)
      // For simplicity, we can fetch the full order and broadcast 'order:update'
      const fullOrder = await this.getById(item.orderId);
      if (fullOrder) {
          kdsService.broadcastOrderUpdate(fullOrder);
      }

      return item;
  }

  /**
   * Validate products and calculate order totals.
   * @private
   */
  private async validateAndCalculateItems(
    tx: Prisma.TransactionClient,
    items: OrderItemInput[]
  ): Promise<{ itemDataList: OrderItemData[]; stockUpdates: StockUpdate[]; subtotal: number }> {
    let subtotal = 0;
    const itemDataList: OrderItemData[] = [];
    const stockUpdates: StockUpdate[] = [];

    const productIds = items.map(i => i.productId);
    
    // Optimize: Batch fetch
    const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { ingredients: true }
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) throw new Error(`Product ID ${item.productId} not found`);
      if (!product.isActive) throw new Error(`Product ${product.name} is not active`);

      const price = Number(product.price);
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      itemDataList.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: price,
        notes: item.notes,
        status: 'PENDING'
      });

      // Prepare stock updates if stockable
      if (product.isStockable && product.ingredients.length > 0) {
        for (const ing of product.ingredients) {
          stockUpdates.push({
            ingredientId: ing.ingredientId,
            quantity: Number(ing.quantity) * item.quantity
          });
        }
      }
    }

    return { itemDataList, stockUpdates, subtotal };
  }

  /**
   * Process stock deductions for order items.
   * @private
   * 
   * @business_rule
   * Prevents stock corruption coverage if the "Stock Management" module is disabled via TenantConfig (enableStock).
   * If disabled, this function exits gracefully without modifying database state.
   */
  private async processStockUpdates(
    tx: Prisma.TransactionClient,
    stockUpdates: StockUpdate[]
  ): Promise<void> {
    // Only execute if Stock Module is enabled
    // This wrapper ensures we respect the TenantConfig contract
    await executeIfEnabled('enableStock', async () => {
        for (const update of stockUpdates) {
            await stockService.register(
                update.ingredientId,
                StockMoveType.SALE,
                update.quantity,
                tx
            );
        }
    });
  }


  async getOrderByTable(tableId: number) {
    return await prisma.order.findFirst({
      where: {
        tableId,
        paymentStatus: { in: ['PENDING', 'PARTIAL'] }
      },
      include: {
        items: { include: { product: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addItemsToOrder(orderId: number, newItems: OrderItemInput[], serverId: number) {
    return await prisma.$transaction(async (tx) => {
      // 1. Get existing order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) throw new Error('Order not found');
      if (order.paymentStatus === 'PAID') throw new Error('Cannot modify paid order');

      // 2. Validate and calculate new items
      let additionalTotal = 0;
      const itemDataList = [];
      const stockUpdates = [];

      // Optimize: Fetch all products in one query
      const productIds = newItems.map(i => i.productId);
      const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: { ingredients: true }
      });
      
      const productMap = new Map(products.map(p => [p.id, p]));

      for (const item of newItems) {
        const product = productMap.get(item.productId);

        if (!product) throw new Error(`Product ID ${item.productId} not found`);
        if (!product.isActive) throw new Error(`Product ${product.name} is not active`);

        const price = Number(product.price);
        const itemTotal = price * item.quantity;
        additionalTotal += itemTotal;

        itemDataList.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: price,
          notes: item.notes,
          status: 'PENDING'
        });

        // Prepare Stock Updates
        if (product.isStockable && product.ingredients.length > 0) {
          for (const ing of product.ingredients) {
            stockUpdates.push({
              ingredientId: ing.ingredientId,
              quantity: Number(ing.quantity) * item.quantity
            });
          }
        }
      }

      // 3. Create new order items
      for (const itemData of itemDataList) {
        await tx.orderItem.create({
          data: {
            orderId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            notes: itemData.notes ?? null,
            status: 'PENDING'
          }
        });
      }

      // 4. Update order totals
      const newSubtotal = Number(order.subtotal) + additionalTotal;
      const newTotal = Number(order.total) + additionalTotal;

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newTotal
        },
        include: { items: { include: { product: true } } }
      });

      // 5. Update Stock
      const stockService = new StockMovementService();
      for (const update of stockUpdates) {
        await stockService.register(
          update.ingredientId,
          StockMoveType.SALE,
          update.quantity,
          tx
        );
      }

      return updatedOrder;
    });
  }

  async getRecentOrders() {
      return await prisma.order.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } }
      });
  }

  /**
   * Get active orders for KDS (Kitchen Display System)
   * Returns orders that are not CLOSED, CANCELLED or DELIVERED
   * Focuses on orders that need kitchen attention.
   */
  async getActiveOrders() {
    return await prisma.order.findMany({
      where: {
        status: { in: ['OPEN', 'CONFIRMED', 'PREPARED'] },
        createdAt: {
            gte: new Date(new Date().setHours(0,0,0,0)) // From today
        }
      },
      include: {
        items: {
            include: { product: true },
            where: { status: { not: 'SERVED' } } 
        },
        table: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Update order status and broadcast to KDS
   */
  async updateStatus(orderId: number, status: OrderStatus) {
    const data: any = { status };
    
    // Auto-close order if terminal status
    if (['DELIVERED', 'CANCELLED', 'CLOSED'].includes(status)) {
        data.closedAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data,
      include: { items: { include: { product: true } }, table: true }
    });

    // Broadcast update
    kdsService.broadcastOrderUpdate(order);

    return order;
  }
}

export const orderService = new OrderService();
