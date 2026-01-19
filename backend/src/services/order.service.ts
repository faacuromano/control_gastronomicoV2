    
/**
 * @fileoverview Order management service (Facade).
 * Handles order creation, updates, and lifecycle management.
 * 
 * @module services/order.service
 * @pattern Facade - Delegates to specialized services for better SRP
 * @see orderItem.service.ts - Item validation and calculation
 * @see orderKitchen.service.ts - KDS operations
 * @see orderDelivery.service.ts - Delivery operations  
 * @see orderStatus.service.ts - Status transitions
 */

import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, OrderStatus, PaymentMethod } from '@prisma/client';
import { StockMovementService } from './stockMovement.service';
import { orderNumberService } from './orderNumber.service';
import { paymentService } from './payment.service';
import { kdsService } from './kds.service';
import { executeIfEnabled, isFeatureEnabled } from './featureFlags.service';
import { LoyaltyService } from './loyalty.service';
import { logger } from '../utils/logger';

// Extracted specialized services
import { orderKitchenService } from './orderKitchen.service';
import { orderDeliveryService } from './orderDelivery.service';
import { orderStatusService } from './orderStatus.service';
import { orderItemService } from './orderItem.service';

// Types from centralized definitions
import type {
    OrderItemInput,
    DeliveryData,
    CreateOrderInput,
    OrderItemData,
    StockUpdate,
    OrderCreateData
} from '../types/order.types';

// Re-export types for backwards compatibility
export type { OrderItemInput, DeliveryData, CreateOrderInput };

const stockService = new StockMovementService();
const loyaltyService = new LoyaltyService();

export class OrderService {
  
  /**
   * Get order by ID with full relations
   */
  async getById(id: number) {
      return await prisma.order.findUnique({
          where: { id },
          include: {
              items: {
                  include: {
                      product: true,
                      modifiers: { include: { modifierOption: true } }
                  }
              },
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
    // Check if stock validation is enabled BEFORE transaction
    const stockEnabled = await isFeatureEnabled('enableStock');

    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Validate Products & Calculate Totals (stock validation if enabled)
      const { itemDataList, stockUpdates, subtotal } = await this.validateAndCalculateItems(
        tx,
        data.items,
        stockEnabled
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

      // 4. Process payments - Map dynamic codes to PaymentMethod enum
      const mapToPaymentMethod = (code: string): PaymentMethod => {
          const codeUpper = code.toUpperCase();
          // Direct enum matches
          if (codeUpper in PaymentMethod) {
              return PaymentMethod[codeUpper as keyof typeof PaymentMethod];
          }
          // Common mappings for dynamic codes
          if (['DEBIT', 'CREDIT', 'DEBITO', 'CREDITO', 'TARJETA'].includes(codeUpper)) {
              return PaymentMethod.CARD;
          }
          if (['EFECTIVO'].includes(codeUpper)) {
              return PaymentMethod.CASH;
          }
          if (['TRANSFERENCIA', 'BANCO'].includes(codeUpper)) {
              return PaymentMethod.TRANSFER;
          }
          if (['MERCADOPAGO', 'MP', 'QR'].includes(codeUpper)) {
              return PaymentMethod.QR_INTEGRATED;
          }
          // Default to CASH for unknown codes
          console.warn(`[OrderService] Unknown payment code "${code}" - defaulting to CASH`);
          return PaymentMethod.CASH;
      };
      
      const singlePaymentMethod = data.paymentMethod === 'SPLIT' ? undefined : 
          (data.paymentMethod ? mapToPaymentMethod(data.paymentMethod) : undefined);
      
      const splitPayments = data.payments?.map(p => ({
        ...p,
        method: mapToPaymentMethod(p.method)
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
        // Set fulfillmentType for delivery orders so they appear in dashboard
        ...(data.channel === 'DELIVERY_APP' || data.deliveryData ? {
          fulfillmentType: 'SELF_DELIVERY'
        } : {}),
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
            status: 'PENDING',
            ...(item.modifiers ? {
                modifiers: {
                    create: item.modifiers.map(m => ({
                        modifierOptionId: m.id,
                        priceCharged: m.price
                    }))
                }
            } : {})
          }))
        }
      };

      // Add optional fields
      if (data.tableId) createData.tableId = data.tableId;
      if (data.clientId) createData.clientId = data.clientId;
      if (data.serverId) createData.serverId = data.serverId;
      // Auto-close only if fully paid AND NOT a delivery order
      // Delivery orders must remain OPEN/CONFIRMED until delivered
      if (paymentResult.isFullyPaid && data.channel !== 'DELIVERY_APP') {
          createData.closedAt = new Date();
      }
      
      // Delivery Fields - No cast needed, OrderCreateData already has these fields
      if (data.deliveryData) {
          createData.deliveryAddress = data.deliveryData.address;
          // Only assign deliveryNotes if it's defined (exactOptionalPropertyTypes)
          if (data.deliveryData.notes !== undefined) {
              createData.deliveryNotes = data.deliveryData.notes;
          }
          if (data.deliveryData.driverId) {
             createData.driverId = data.deliveryData.driverId;
          }
      }

      // Add payments if any
      if (paymentResult.paymentsToCreate.length > 0) {
        createData.payments = { create: paymentResult.paymentsToCreate };
      }

      // 6. Create order - Use Prisma.OrderCreateInput for type safety
      const order = await tx.order.create({
        data: createData as Prisma.OrderCreateInput,
        include: { items: true }
      });

      // 7. Update Stock
      await this.processStockUpdates(tx, stockUpdates, orderNumber);

      // 8. Update Table Status
      // FIX RC-003: Verify table is FREE before occupying to prevent race condition
      if (data.tableId) {
        const table = await tx.table.findUnique({
          where: { id: data.tableId }
        });

        if (!table) {
          throw new Error(`INVALID_TABLE: Table with ID ${data.tableId} not found`);
        }

        if (table.status !== 'FREE') {
          throw new Error(`TABLE_OCCUPIED: Table "${table.name}" is already occupied (currentOrderId: ${table.currentOrderId})`);
        }

        await tx.table.update({
          where: { id: data.tableId },
          data: { status: 'OCCUPIED', currentOrderId: order.id }
        });
      }

      // 9. Award loyalty points INSIDE TRANSACTION for atomicity
      // This ensures points are only awarded if the entire order creation succeeds
      let pointsAwarded = 0;
      if (data.clientId && paymentResult.isFullyPaid) {
          pointsAwarded = await loyaltyService.awardPoints(data.clientId, Number(total), tx);
      }

      return { order, pointsAwarded };
    });

    // Log loyalty points outside transaction (logging shouldn't fail the order)
    if (txResult.pointsAwarded > 0) {
        logger.info('Loyalty points awarded', { 
            clientId: data.clientId, 
            points: txResult.pointsAwarded, 
            orderId: txResult.order.id 
        });
    }

    const order = txResult.order;

    // 10. Broadcast to KDS (Outside transaction)
    if (order.status === 'CONFIRMED' || order.status === 'OPEN') {
        const fullOrder = await this.getById(order.id);
        if (fullOrder) {
            kdsService.broadcastNewOrder(fullOrder);
        }
    }

    return order;
  }

  /**
   * Assign a driver to an order.
   * @delegates orderDeliveryService.assignDriver
   */
  async assignDriver(orderId: number, driverId: number) {
    return orderDeliveryService.assignDriver(orderId, driverId);
  }

  /**
   * Get active delivery orders.
   * @delegates orderDeliveryService.getDeliveryOrders
   */
  async getDeliveryOrders() {
    return orderDeliveryService.getDeliveryOrders();
  }

  /**
   * Update individual order item status.
   * @delegates orderKitchenService.updateItemStatus
   */
  async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED') {
    return orderKitchenService.updateItemStatus(itemId, status);
  }

  /**
   * Mark all items in an order as SERVED.
   * @delegates orderKitchenService.markAllItemsServed
   */
  async markAllItemsServed(orderId: number) {
    return orderKitchenService.markAllItemsServed(orderId);
  }

  /**
   * Validate products and calculate order totals.
   * @delegates orderItemService.validateAndCalculateItems
   */
  private async validateAndCalculateItems(
    tx: Prisma.TransactionClient,
    items: OrderItemInput[],
    stockEnabled: boolean = true
  ) {
    return orderItemService.validateAndCalculateItems(tx, items, stockEnabled);
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
    stockUpdates: StockUpdate[],
    orderNumber: number
  ): Promise<void> {
    // Only execute if Stock Module is enabled
    // This wrapper ensures we respect the TenantConfig contract
    await executeIfEnabled('enableStock', async () => {
        for (const update of stockUpdates) {
            await stockService.register(
                update.ingredientId,
                StockMoveType.SALE,
                update.quantity,
                `Order #${orderNumber}`,
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
        items: {
            include: {
                product: true,
                modifiers: { include: { modifierOption: true } }
            }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addItemsToOrder(orderId: number, newItems: OrderItemInput[], serverId: number) {
    // Check if stock validation is enabled BEFORE transaction
    const stockEnabled = await isFeatureEnabled('enableStock');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get existing order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) throw new Error('Order not found');
      if (order.paymentStatus === 'PAID') throw new Error('Cannot modify paid order');

      // 2. Validate and calculate new items using extracted service
      const { itemDataList, stockUpdates, subtotal: additionalTotal } = 
        await orderItemService.validateAndCalculateItems(tx, newItems, stockEnabled);

      // 3. Create new order items
      for (const itemData of itemDataList) {
        await tx.orderItem.create({
          data: {
            orderId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            notes: itemData.notes ?? null,
            status: 'PENDING',
            ...(itemData.modifiers ? {
                modifiers: {
                    create: itemData.modifiers.map((m: { id: number; price: number }) => ({
                        modifierOptionId: m.id,
                        priceCharged: m.price
                    }))
                }
            } : {})
          }
        });
      }

      // 4. Update order totals and REOPEN if needed (for KDS visibility)
      const newSubtotal = Number(order.subtotal) + additionalTotal;
      const newTotal = Number(order.total) + additionalTotal;

      // If order was DELIVERED or PREPARED, reopen it to OPEN so new items appear in KDS
      const shouldReopen = ['DELIVERED', 'PREPARED'].includes(order.status);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          ...(shouldReopen ? { status: 'OPEN' as OrderStatus } : {})
        },
        include: { items: { include: { product: true } } }
      });

      // 5. Update Stock (if module enabled)
      await executeIfEnabled('enableStock', async () => {
        const stockService = new StockMovementService();
        for (const update of stockUpdates) {
          await stockService.register(
            update.ingredientId,
            StockMoveType.SALE,
            update.quantity,
            `Order #${order.orderNumber}`,
            tx
          );
        }
      });

      return updatedOrder;
    });

    // 6. Broadcast to KDS (Outside transaction) - NEW: Notify kitchen of added items
    const fullOrder = await this.getById(orderId);
    if (fullOrder) {
        kdsService.broadcastOrderUpdate(fullOrder);
    }

    return result;
  }

  async getRecentOrders() {
      return await prisma.order.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } }
      });
  }

  /**
   * Get active orders for KDS (Kitchen Display System).
   * @delegates orderKitchenService.getActiveOrders
   */
  async getActiveOrders() {
    return orderKitchenService.getActiveOrders();
  }

  /**
   * Update order status with state machine validation.
   * @delegates orderStatusService.updateStatus
   */
  async updateStatus(orderId: number, status: OrderStatus) {
    return orderStatusService.updateStatus(orderId, status);
  }
}

export const orderService = new OrderService();
