    
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
import { Prisma, StockMoveType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { StockMovementService } from './stockMovement.service';
import { orderNumberService } from './orderNumber.service';
import { paymentService } from './payment.service';
import { kdsService } from './kds.service';
import { executeIfEnabled, isFeatureEnabled } from './featureFlags.service';
import { LoyaltyService } from './loyalty.service';
import { logger } from '../utils/logger';
import { getBusinessDate } from '../utils/businessDate';
import { auditService } from './audit.service';
import { mapToPaymentMethod } from '../utils/paymentMethod';
import {
    NotFoundError,
    ValidationError,
    ConflictError,
    BadRequestError
} from '../utils/errors';

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
    OrderCreateData,
    AddPaymentsRequest,
    AddPaymentsResult
} from '../types/order.types';

// Re-export types for backwards compatibility
export type { OrderItemInput, DeliveryData, CreateOrderInput, AddPaymentsRequest, AddPaymentsResult };

const stockService = new StockMovementService();
const loyaltyService = new LoyaltyService();

export class OrderService {
  
  /**
   * Get order by ID with full relations
   */
  async getById(id: number, tenantId: number) {
      return await prisma.order.findFirst({
          where: { id, tenantId },
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
    // Resolve Tenant ID first (needed for feature flag check)
    const tenantId = data.tenantId;
    if (!tenantId) throw new ValidationError('Tenant ID required');

    // Check if stock validation is enabled BEFORE transaction
    const stockEnabled = await isFeatureEnabled('enableStock', tenantId);

    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Validate Products & Calculate Totals (stock validation if enabled)
      const { itemDataList, stockUpdates, subtotal } = await this.validateAndCalculateItems(
        tx,
        data.items,
        tenantId,
        stockEnabled
      );

      // Apply discount if provided (from POS checkout)
      const discountAmount = Math.min(Math.max(data.discount || 0, 0), subtotal);
      const total = subtotal - discountAmount;

      // 2. Determine Robust Business Date (Shift or System)
      // FIX: Use new service that handles "No Shift" scenarios gracefully
      const businessDate = await import('../services/businessDate.service')
        .then(m => m.businessDateService.determineBusinessDate(tenantId, data.serverId));

      // 3. Generate Atomic Order Number scoped to Tenant + Date
      const { orderNumber } = await orderNumberService.getNextOrderNumber(tx, tenantId, businessDate);

      // 4. Validate active shift (Optional - BusinessDateService handles fallback, but we might want to attach shiftId)
      let shiftId: number | undefined;
      if (data.serverId) {
        const activeShift = await tx.cashShift.findFirst({
            where: { userId: data.serverId, tenantId, endTime: null }
        });
        if (activeShift) {
            shiftId = activeShift.id;
        } else {
             // Non-blocking: We allow orders without shift (e.g. Early Waiter / Delivery)
             // But we log it
             logger.warn('ORDER_CREATED_WITHOUT_SHIFT', { serverId: data.serverId, businessDate });
        }
      }

      // 5. Process payments
      const singlePaymentMethod = data.paymentMethod === 'SPLIT' ? undefined : 
          (data.paymentMethod ? mapToPaymentMethod(data.paymentMethod) : undefined);
      
      const splitPayments = data.payments?.map(p => ({
        ...p,
        method: mapToPaymentMethod(p.method)
      }));

      // NOTE: Payment processing needs active shift to link payment? 
      // If no shift, payment is orphan? Or linked to "System Shift"?
      // For now, allow orphan payments if shiftId is undefined, but PaymentService might require it.
      // We pass shiftId ?? 0 or handle inside PaymentService.
      // Logic Update: If no shift, we can't register Cash Movement linked to a shift.
      
      // Note: shiftId may be undefined if no active shift exists.
      // Payments are only persisted when shiftId is valid (see guard at line ~204).
      const paymentResult = paymentService.processPayments(
        total,
        shiftId ?? null,
        singlePaymentMethod,
        splitPayments
      );

      // 6. Build order create data (using unchecked create with scalar FKs)
      const orderData: any = {
        tenantId,
        orderNumber,
        channel: data.channel ?? 'POS',
        ...(data.channel === 'DELIVERY_APP' || (data.deliveryData?.address) ? {
          fulfillmentType: 'SELF_DELIVERY'
        } : {}),
        status: paymentResult.isFullyPaid ? 'CONFIRMED' : 'OPEN',
        paymentStatus: paymentResult.paymentStatus,
        subtotal,
        discount: discountAmount,
        total,
        businessDate,
        items: {
          create: itemDataList.map(item => ({
            tenantId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes ?? null,
            status: 'PENDING',
            ...(item.modifiers && item.modifiers.length > 0 ? {
                modifiers: {
                    create: item.modifiers.map(m => ({
                        tenantId,
                        modifierOptionId: m.id,
                        priceCharged: m.price
                    }))
                }
            } : {})
          }))
        }
      };

      // P1-01: Validate FK ownership before assigning to order
      if (data.tableId) orderData.tableId = data.tableId;
      if (data.clientId) {
        const client = await tx.client.findFirst({ where: { id: data.clientId, tenantId } });
        if (!client) throw new NotFoundError(`Client ${data.clientId}`);
        orderData.clientId = data.clientId;
      }
      if (data.serverId) {
        const server = await tx.user.findFirst({ where: { id: data.serverId, tenantId } });
        if (!server) throw new NotFoundError(`Server ${data.serverId}`);
        orderData.serverId = data.serverId;
      }
      if (paymentResult.isFullyPaid && data.channel !== 'DELIVERY_APP') {
          orderData.closedAt = new Date();
      }

      if (data.deliveryData) {
          orderData.deliveryAddress = data.deliveryData.address;
          if (data.deliveryData.notes !== undefined) orderData.deliveryNotes = data.deliveryData.notes;
          if (data.deliveryData.driverId) orderData.driverId = data.deliveryData.driverId;
      }

      // Add payments if any (Only if shift exists or we modify logic)
      if (paymentResult.paymentsToCreate.length > 0 && shiftId) {
        orderData.payments = { create: paymentResult.paymentsToCreate.map(p => ({ ...p, tenantId })) };
      }

      // 7. Create order
      const order = await tx.order.create({
        data: orderData,
        include: { items: true }
      });

      // 8. Update Stock
      await this.processStockUpdates(tx, tenantId, stockUpdates, orderNumber);

      // 9. Update Table Status
      if (data.tableId) {
        const table = await tx.table.findFirst({ where: { id: data.tableId, tenantId } });
        if (!table) throw new NotFoundError(`Table ${data.tableId}`);
        
        if (table.status !== 'FREE') {
           throw new ConflictError('Table is currently occupied');
        }
        // SAFE: tx.table.findFirst at L211 verifies tenant ownership
        await tx.table.updateMany({
          where: { id: data.tableId, tenantId },
          data: { status: 'OCCUPIED', currentOrderId: order.id }
        });
      }

      // 10. Loyalty
      let pointsAwarded = 0;
      if (data.clientId && paymentResult.isFullyPaid) {
          pointsAwarded = await loyaltyService.awardPoints(data.clientId, Number(total), tx, tenantId);
      }

      return { order, pointsAwarded };
    });

    if (txResult.pointsAwarded > 0) {
        logger.info('Loyalty points awarded', { 
            clientId: data.clientId, 
            points: txResult.pointsAwarded, 
            orderId: txResult.order.id 
        });
    }

    const order = txResult.order;

    // 11. Broadcast to KDS
    if (order.status === 'CONFIRMED' || order.status === 'OPEN') {
        const fullOrder = await this.getById(order.id, tenantId);
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
  async assignDriver(orderId: number, driverId: number, tenantId: number) {
    return orderDeliveryService.assignDriver(orderId, driverId, tenantId);
  }

  /**
   * Get active delivery orders.
   * @delegates orderDeliveryService.getDeliveryOrders
   */
  async getDeliveryOrders(tenantId: number) {
    return orderDeliveryService.getDeliveryOrders(tenantId);
  }

  /**
   * Update individual order item status.
   * @delegates orderKitchenService.updateItemStatus
   */
  async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED', tenantId: number) {
    return orderKitchenService.updateItemStatus(itemId, status, tenantId);
  }

  /**
   * Mark all items in an order as SERVED.
   * @delegates orderKitchenService.markAllItemsServed
   */
  async markAllItemsServed(orderId: number, tenantId: number) {
    return orderKitchenService.markAllItemsServed(orderId, tenantId);
  }

  /**
   * Validate products and calculate order totals.
   * @delegates orderItemService.validateAndCalculateItems
   */
  private async validateAndCalculateItems(
    tx: Prisma.TransactionClient,
    items: OrderItemInput[],
    tenantId: number,
    stockEnabled: boolean = true
  ) {
    return orderItemService.validateAndCalculateItems(tx, items, tenantId, stockEnabled);
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
    tenantId: number,
    stockUpdates: StockUpdate[],
    orderNumber: number
  ): Promise<void> {
    // Only execute if Stock Module is enabled
    await executeIfEnabled('enableStock', async () => {
        // P1-05: Use batch method to reduce N+1 queries
        await stockService.registerBatch(
            stockUpdates,
            tenantId,
            StockMoveType.SALE,
            `Order #${orderNumber}`,
            tx
        );
    }, tenantId);
  }


  /**
   * Add payments to an existing order.
   *
   * STEP 2: INTERFACE CONTRACT
   * --------------------------
   * @param {number} orderId - Order ID (must be positive integer > 0)
   * @param {AddPaymentsRequest} request - Payment data with optional closeOrder flag
   * @param {number} tenantId - Tenant ID for multi-tenant isolation (CRITICAL)
   * @param {number} userId - Authenticated user ID for audit trail
   * @param {number} [shiftId] - Active cash shift ID (optional, will attempt to resolve)
   * @param {object} [auditContext] - Additional audit context (IP, User-Agent)
   *
   * @returns {Promise<AddPaymentsResult>} Result containing payment details and status
   *
   * @throws {NotFoundError} - Order not found or belongs to different tenant
   * @throws {ValidationError} - Invalid payment amounts (zero, negative, or excessive overpayment)
   * @throws {ConflictError} - Order already fully paid or cancelled
   * @throws {BadRequestError} - No active shift when required for cash payments
   *
   * @side_effects
   * - Creates Payment records in database
   * - Updates Order.paymentStatus
   * - Optionally updates Order.status to CONFIRMED and sets closedAt
   * - Optionally frees associated Table
   * - Creates AuditLog entries for PAYMENT_RECEIVED
   * - Broadcasts order update via KDS WebSocket
   *
   * STEP 1: COMPLEXITY ANALYSIS
   * ---------------------------
   * Time: O(n + m) where n = new payments, m = existing payments
   * Space: O(n) for payment records to create
   *
   * @example
   * const result = await orderService.addPayments(
   *   123,
   *   { payments: [{ method: 'CASH', amount: 50 }, { method: 'CARD', amount: 30 }], closeOrder: true },
   *   1, // tenantId
   *   5, // userId
   *   10 // shiftId
   * );
   */
  async addPayments(
    orderId: number,
    request: AddPaymentsRequest,
    tenantId: number,
    userId: number,
    shiftId?: number,
    auditContext?: { ipAddress?: string; userAgent?: string }
  ): Promise<AddPaymentsResult> {
    // =================================================================
    // STEP 3: IMPLEMENTATION
    // =================================================================

    // ---- Input Validation (Defensive Programming) ----
    if (!orderId || orderId <= 0 || !Number.isInteger(orderId)) {
      throw new ValidationError('Order ID must be a positive integer');
    }
    if (!tenantId || tenantId <= 0) {
      throw new ValidationError('Tenant ID must be a positive integer');
    }
    if (!request.payments || !Array.isArray(request.payments) || request.payments.length === 0) {
      throw new ValidationError('At least one payment is required');
    }

    // Validate individual payments - O(n)
    for (const payment of request.payments) {
      if (typeof payment.amount !== 'number' || !Number.isFinite(payment.amount)) {
        throw new ValidationError(`Invalid payment amount: ${payment.amount}`);
      }
      if (payment.amount <= 0) {
        throw new ValidationError(`Payment amount must be positive: ${payment.amount}`);
      }
      if (!payment.method || typeof payment.method !== 'string' || payment.method.trim().length === 0) {
        throw new ValidationError('Payment method is required');
      }
    }

    // Calculate total amount to add - O(n)
    const amountToAdd = request.payments.reduce((sum, p) => sum + p.amount, 0);

    // ---- Execute within Transaction for ACID compliance ----
    const result = await prisma.$transaction(async (tx) => {
      // 1. Acquire exclusive row lock to prevent concurrent payment race condition
      // Two concurrent addPayments calls could both read the same previouslyPaid value,
      // leading to overpayment. SELECT FOR UPDATE serializes access to this row.
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} AND tenantId = ${tenantId} FOR UPDATE`;

      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          payments: true,
          table: true
        }
      });

      // ---- Edge Case: Order not found or tenant mismatch ----
      if (!order) {
        throw new NotFoundError('Order');
      }

      // ---- Edge Case: Order already cancelled ----
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictError('Cannot add payments to a cancelled order');
      }

      // ---- Edge Case: Order already fully paid ----
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictError('Order is already fully paid');
      }

      // 2. Calculate existing payments - O(m)
      const previouslyPaid = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const orderTotal = Number(order.total);
      const projectedTotal = previouslyPaid + amountToAdd;

      // ---- Edge Case: Excessive overpayment (>10% tolerance) ----
      const maxAllowed = orderTotal * 1.10; // 10% tolerance for rounding
      if (projectedTotal > maxAllowed && orderTotal > 0) {
        throw new ValidationError(
          `Payment total (${projectedTotal.toFixed(2)}) exceeds order total (${orderTotal.toFixed(2)}) by more than 10%`
        );
      }

      // 3. Resolve shift ID if not provided
      let resolvedShiftId = shiftId;
      if (!resolvedShiftId) {
        // Attempt to find active shift for user
        const activeShift = await tx.cashShift.findFirst({
          where: { userId, tenantId, endTime: null }
        });
        if (activeShift) {
          resolvedShiftId = activeShift.id;
        } else {
          // Check if any payment requires shift (CASH typically does)
          const requiresShift = request.payments.some(p => {
            const method = mapToPaymentMethod(p.method);
            return method === PaymentMethod.CASH;
          });
          if (requiresShift) {
            logger.warn('Payment added without active shift', { orderId, userId });
            // Don't throw - allow orphan payments for flexibility
            // Business rule: Some establishments may not use shifts
          }
        }
      }

      // 4. Create payment records - O(n)
      const paymentIds: number[] = [];
      for (const payment of request.payments) {
        const createdPayment = await tx.payment.create({
          data: {
            tenantId,
            orderId,
            amount: payment.amount,
            method: mapToPaymentMethod(payment.method),
            shiftId: resolvedShiftId ?? null
          }
        });
        paymentIds.push(createdPayment.id);

        // Audit log each payment (non-blocking)
        auditService.logPayment('PAYMENT_RECEIVED', createdPayment.id, {
          tenantId,
          userId,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent
        }, {
          orderId,
          amount: payment.amount,
          method: payment.method,
          orderTotal,
          previouslyPaid,
          newTotalPaid: projectedTotal
        }).catch(err => logger.error('Audit log failed', { err }));
      }

      // 5. Calculate new payment status
      const totalPaid = projectedTotal;
      const remainingBalance = orderTotal - totalPaid;
      let newPaymentStatus: PaymentStatus;

      if (totalPaid >= orderTotal) {
        newPaymentStatus = PaymentStatus.PAID;
      } else if (totalPaid > 0) {
        newPaymentStatus = PaymentStatus.PARTIAL;
      } else {
        newPaymentStatus = PaymentStatus.PENDING;
      }

      // 6. Determine if order should be closed
      const shouldCloseOrder = request.closeOrder === true && newPaymentStatus === PaymentStatus.PAID;

      // 7. Update order
      const updateData: Prisma.OrderUpdateInput = {
        paymentStatus: newPaymentStatus
      };

      if (shouldCloseOrder) {
        updateData.status = OrderStatus.CONFIRMED;
        updateData.closedAt = new Date();
      }

      // SAFE: tx.order.findFirst at L415 verifies tenant ownership
      await tx.order.update({
        where: { id: orderId },
        data: updateData
      });

      // 8. Free table if order closed and has associated table
      if (shouldCloseOrder && order.tableId) {
        await tx.table.updateMany({
          where: { id: order.tableId, tenantId },
          data: {
            status: 'FREE',
            currentOrderId: null
          }
        });
        logger.info('Table freed after payment', { tableId: order.tableId, orderId });
      }

      return {
        orderId,
        orderTotal,
        previouslyPaid,
        amountAdded: amountToAdd,
        totalPaid,
        remainingBalance,
        paymentStatus: newPaymentStatus,
        orderClosed: shouldCloseOrder,
        paymentIds
      };
    }, {
      // Use READ COMMITTED to prevent dirty reads while allowing concurrent reads
      // For stronger consistency, use SERIALIZABLE but at cost of performance
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // Timeout after 10 seconds to prevent long-running transactions
      timeout: 10000
    });

    // 9. Broadcast update to KDS (outside transaction)
    const fullOrder = await this.getById(orderId, tenantId);
    if (fullOrder) {
      kdsService.broadcastOrderUpdate(fullOrder);
    }

    logger.info('Payments added to order', {
      orderId,
      paymentCount: request.payments.length,
      amountAdded: result.amountAdded,
      newStatus: result.paymentStatus,
      closed: result.orderClosed
    });

    return result;
  }

  async getOrderByTable(tableId: number, tenantId: number) {
    return await prisma.order.findFirst({
      where: {
        tableId,
        tenantId,
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

  async addItemsToOrder(orderId: number, newItems: OrderItemInput[], serverId: number, tenantId: number) {
    // Check if stock validation is enabled BEFORE transaction
    const stockEnabled = await isFeatureEnabled('enableStock', tenantId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get existing order
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true }
      });

      if (!order) throw new NotFoundError('Order');
      if (order.paymentStatus === 'PAID') throw new ValidationError('Cannot modify paid order');

      // 2. Validate and calculate new items using extracted service
      const { itemDataList, stockUpdates, subtotal: additionalTotal } = 
        await orderItemService.validateAndCalculateItems(tx, newItems, tenantId, stockEnabled);

      // 3. Create new order items
      for (const itemData of itemDataList) {
        await tx.orderItem.create({
          data: {
            tenantId,
            orderId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            notes: itemData.notes ?? null,
            status: 'PENDING',
            ...(itemData.modifiers ? {
                modifiers: {
                    create: itemData.modifiers.map((m: { id: number; price: number }) => ({
                        tenantId,
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

      // SAFE: tx.order.findFirst at L612 verifies tenant ownership
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
            tenantId,
            StockMoveType.SALE,
            update.quantity,
            `Order #${order.orderNumber}`,
            tx
          );
        }
      }, tenantId);

      return updatedOrder;
    });

    // 6. Broadcast to KDS (Outside transaction) - NEW: Notify kitchen of added items
    const fullOrder = await this.getById(orderId, tenantId);
    if (fullOrder) {
        kdsService.broadcastOrderUpdate(fullOrder);
    }

    return result;
  }

  async getRecentOrders(tenantId: number) {
      return await prisma.order.findMany({
          where: { tenantId },
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } }
      });
  }

  /**
   * Get active orders for KDS (Kitchen Display System).
   * @delegates orderKitchenService.getActiveOrders
   */
  async getActiveOrders(tenantId: number) {
    return orderKitchenService.getActiveOrders(tenantId);
  }

  /**
   * Update order status with state machine validation.
   * @delegates orderStatusService.updateStatus
   */
  async updateStatus(orderId: number, status: OrderStatus, tenantId: number) {
    return orderStatusService.updateStatus(orderId, status, tenantId);
  }
}

export const orderService = new OrderService();
