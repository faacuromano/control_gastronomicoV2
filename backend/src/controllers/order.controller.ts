/**
 * @fileoverview Order controller.
 * Handles HTTP requests for order operations.
 * 
 * @module controllers/order.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { OrderService, CreateOrderInput, OrderItemInput } from '../services/order.service';
import { OrderChannel, PaymentMethod, OrderStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

const orderService = new OrderService();

/**
 * Zod schema for order creation validation.
 */
const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
    modifiers: z.array(z.object({
      id: z.number().int().positive(),
      price: z.coerce.number()  // Accept string from Prisma Decimal
    })).optional(),
    removedIngredientIds: z.array(z.number().int().positive()).optional()
  })).min(1, "Order must have at least one item"),
  channel: z.nativeEnum(OrderChannel).optional(),
  tableId: z.number().int().optional(),
  clientId: z.number().int().optional(),
  // Accept PaymentMethod enum values OR 'SPLIT' for split payments
  paymentMethod: z.union([z.nativeEnum(PaymentMethod), z.literal('SPLIT')]).optional(),
  // Accept any string for method to support dynamic payment method codes (CASH, CARD, DEBIT, TRANSFER, etc.)
  payments: z.array(z.object({
      method: z.string().min(1),  // Dynamic payment method codes
      amount: z.number().positive()
  })).optional(),
  deliveryData: z.object({
    address: z.string(),
    notes: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    driverId: z.number().int().optional(),
  }).optional(),
  discount: z.number().min(0).optional(),
});

/**
 * Zod schema for adding items to an existing order.
 */
const addItemsSchema = z.object({
    items: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
        modifiers: z.array(z.object({
            id: z.number().int().positive(),
            price: z.coerce.number()  // Accept string from Prisma Decimal
        })).optional(),
        removedIngredientIds: z.array(z.number().int().positive()).optional()
    })).min(1, "Must add at least one item")
});

/**
 * Zod schema for order status update.
 */
const updateStatusSchema = z.object({
    status: z.nativeEnum(OrderStatus)
});

/**
 * Zod schema for item status update.
 */
const updateItemStatusSchema = z.object({
    status: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED'])
});

/**
 * Zod schema for adding payments to an existing order.
 * Validates payment method codes and amounts with defensive constraints.
 *
 * @validation
 * - payments: Array of at least 1 payment
 * - method: Non-empty string (supports dynamic codes: CASH, CARD, DEBIT, etc.)
 * - amount: Positive number greater than 0
 * - closeOrder: Optional boolean to auto-close order when fully paid
 */
const addPaymentsSchema = z.object({
    payments: z.array(z.object({
        method: z.string()
            .min(1, 'Payment method is required')
            .max(50, 'Payment method too long'),
        amount: z.number()
            .positive('Payment amount must be positive')
            .finite('Payment amount must be a finite number')
            .refine(val => val >= 0.01, 'Payment amount must be at least 0.01')
    })).min(1, 'At least one payment is required')
      .max(10, 'Maximum 10 payments per request'),
    closeOrder: z.boolean().optional().default(false)
});

/**
 * Update order status.
 */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateStatusSchema.parse(req.body);
    const order = await orderService.updateStatus(Number(req.params.id as string), status, req.user!.tenantId!);
    res.json({ success: true, data: order });
});

/**
 * Update individual order item status.
 */
export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateItemStatusSchema.parse(req.body);
    const item = await orderService.updateItemStatus(Number(req.params.itemId as string), status, req.user!.tenantId!);
    res.json({ success: true, data: item });
});

/**
 * Get active orders for KDS.
 */
export const getActiveOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getActiveOrders(req.user!.tenantId!);
    res.json({ success: true, data: orders });
});

/**
 * Create a new order.
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const data = createOrderSchema.parse(req.body);
    
    // Get serverId from authenticated user (typed via express.d.ts)
    const serverId = req.user?.id;

    if (!serverId) {
        throw new UnauthorizedError('User ID required');
    }

    // P0-03 FIX: tenantId must ALWAYS be present — never conditional
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        throw new UnauthorizedError('Tenant context required');
    }

    // Build properly typed order input - map items explicitly to match CreateOrderInput
    const orderInput: CreateOrderInput = {
      tenantId,
      userId: serverId,
      serverId,
      items: data.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: item.modifiers,
          removedIngredientIds: item.removedIngredientIds
      })),
      channel: data.channel,
      tableId: data.tableId,
      clientId: data.clientId,
      paymentMethod: data.paymentMethod,
      payments: data.payments?.map(p => ({ method: p.method.toString(), amount: p.amount })),
      deliveryData: data.deliveryData ? {
          address: data.deliveryData.address,
          notes: data.deliveryData.notes,
          phone: data.deliveryData.phone ?? '',
          name: data.deliveryData.name ?? '',
          driverId: data.deliveryData.driverId
      } : undefined,
      discount: data.discount
    };

    const order = await orderService.createOrder(orderInput);
    res.status(201).json({ success: true, data: order });
});

/**
 * Get recent orders.
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getRecentOrders(req.user!.tenantId!);
    res.json({ success: true, data: orders });
});

/**
 * Get order by table ID.
 */
export const getOrderByTable = asyncHandler(async (req: Request, res: Response) => {
    const tableId = Number(req.params.tableId as string);
    if (isNaN(tableId)) {
        return res.status(400).json({ success: false, error: 'Invalid table ID' });
    }
    const order = await orderService.getOrderByTable(tableId, req.user!.tenantId!);
    res.json({ success: true, data: order });
});

/**
 * Add items to an existing order.
 */
export const addItemsToOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId as string);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }
    const data = addItemsSchema.parse(req.body);
    const serverId = req.user?.id;

    if (!serverId) {
        throw new UnauthorizedError();
    }

    // Map Zod parsed items to OrderItemInput - types are compatible
    const items: OrderItemInput[] = data.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: item.modifiers,
        removedIngredientIds: item.removedIngredientIds
    }));

    const order = await orderService.addItemsToOrder(orderId, items, serverId, req.user!.tenantId!);
    res.json({ success: true, data: order });
});

/**
 * Add payments to an existing order.
 *
 * POST /api/v1/orders/:id/payments
 *
 * @route POST /api/v1/orders/:id/payments
 * @access Private - Requires authentication and orders:update permission
 *
 * @description
 * Adds one or more payments to an existing order. Supports split payments
 * and dynamic payment method codes. Optionally closes the order when fully paid.
 *
 * STEP 4: EDGE CASES HANDLED
 * --------------------------
 * 1. Invalid order ID (NaN, negative, non-integer) - Returns 400
 * 2. Order not found - Returns 404
 * 3. Order belongs to different tenant - Returns 404 (security: no info leak)
 * 4. Order already cancelled - Returns 409 Conflict
 * 5. Order already fully paid - Returns 409 Conflict
 * 6. Zero or negative payment amounts - Returns 400 Validation Error
 * 7. Excessive overpayment (>10% of total) - Returns 400 Validation Error
 * 8. Empty payments array - Returns 400 Validation Error
 * 9. Missing authentication - Returns 401 Unauthorized
 * 10. Concurrent payment attempts - Handled via transaction isolation
 *
 * @requestBody {AddPaymentsRequest}
 * @responseBody {AddPaymentsResult}
 */
export const addPayments = asyncHandler(async (req: Request, res: Response) => {
    // 1. Parse and validate order ID from URL params
    const orderId = Number(req.params.id);
    if (isNaN(orderId) || orderId <= 0 || !Number.isInteger(orderId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid order ID',
            code: 'INVALID_ORDER_ID'
        });
    }

    // 2. Validate request body with Zod schema
    const validationResult = addPaymentsSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: validationResult.error.flatten()
        });
    }
    const data = validationResult.data;

    // 3. Extract authenticated user context
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId) {
        throw new UnauthorizedError('User ID required');
    }
    if (!tenantId) {
        throw new UnauthorizedError('Tenant ID required');
    }

    // 4. Build audit context from request (filter out undefined to satisfy exactOptionalPropertyTypes)
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const auditContext: { ipAddress?: string; userAgent?: string } = {};
    if (ipAddress) auditContext.ipAddress = ipAddress;
    if (userAgent) auditContext.userAgent = userAgent;

    // 5. Call service layer
    const result = await orderService.addPayments(
        orderId,
        {
            payments: data.payments,
            closeOrder: data.closeOrder
        },
        tenantId,
        userId,
        undefined, // shiftId will be resolved by service
        Object.keys(auditContext).length > 0 ? auditContext : undefined
    );

    // 6. Return success response with comprehensive data
    res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * Get active delivery orders.
 */
export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    logger.debug('getDeliveryOrders requested', { userId: req.user?.id });
    const orders = await orderService.getDeliveryOrders(req.user!.tenantId!);
    logger.debug('getDeliveryOrders result', { count: orders.length });
    res.json({ success: true, data: orders });
});

/**
 * Assign driver to order.
 */
export const assignDriver = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.id as string);
    const { driverId } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' });
    if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });

    const order = await orderService.assignDriver(orderId, Number(driverId), req.user!.tenantId!);
    res.json({ success: true, data: order });
});

/**
 * Mark all items in an order as SERVED.
 * Used by kitchen when table order is ready for pickup by waiter.
 */
export const markAllItemsServed = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId as string);
    
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const order = await orderService.markAllItemsServed(orderId, req.user!.tenantId!);
    res.json({ success: true, data: order });
});

// =============================================================================
// PHASE 2: VOID & TRANSFER OPERATIONS
// =============================================================================

import { orderVoidService, VoidReason, VOID_REASONS } from '../services/orderVoid.service';
import { orderTransferService } from '../services/orderTransfer.service';

/**
 * Zod schema for void item validation.
 */
const voidItemSchema = z.object({
    reason: z.enum(VOID_REASONS as unknown as [string, ...string[]]),
    notes: z.string().optional()
});

/**
 * Void (cancel) an order item.
 * Requires orders:delete permission (manager action).
 */
export const voidItem = asyncHandler(async (req: Request, res: Response) => {
    const itemId = Number(req.params.itemId as string);
    if (isNaN(itemId)) {
        return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }
    
    const data = voidItemSchema.parse(req.body);
    
    const tenantId = req.user!.tenantId!;
    const result = await orderVoidService.voidItem(
        {
            orderItemId: itemId,
            reason: data.reason as VoidReason,
            notes: data.notes
        },
        tenantId,
        {
            userId: req.user?.id,
            tenantId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    );
    
    res.json({ success: true, data: result });
});

/**
 * Get available void reasons for UI dropdown.
 */
export const getVoidReasons = asyncHandler(async (_req: Request, res: Response) => {
    const reasons = orderVoidService.getVoidReasons();
    res.json({ success: true, data: reasons });
});

/**
 * Zod schema for transfer items validation.
 */
const transferItemsSchema = z.object({
    itemIds: z.array(z.number().int().positive()).min(1),
    fromTableId: z.number().int().positive(),
    toTableId: z.number().int().positive()
});

/**
 * Transfer items between tables.
 */
export const transferItems = asyncHandler(async (req: Request, res: Response) => {
    const data = transferItemsSchema.parse(req.body);
    
    const tenantId = req.user!.tenantId!;
    const result = await orderTransferService.transferItems(
        data.itemIds,
        data.fromTableId,
        data.toTableId,
        tenantId,
        {
            userId: req.user?.id,
            tenantId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    );
    
    res.json({ success: true, data: result });
});

