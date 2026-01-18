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
 * Update order status.
 */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateStatusSchema.parse(req.body);
    const order = await orderService.updateStatus(Number(req.params.id as string), status);
    res.json({ success: true, data: order });
});

/**
 * Update individual order item status.
 */
export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateItemStatusSchema.parse(req.body);
    const item = await orderService.updateItemStatus(Number(req.params.itemId as string), status);
    res.json({ success: true, data: item });
});

/**
 * Get active orders for KDS.
 */
export const getActiveOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getActiveOrders();
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

    // Build properly typed order input - map items explicitly to match CreateOrderInput
    const orderInput: CreateOrderInput = {
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
      } : undefined
    };

    const order = await orderService.createOrder(orderInput);
    res.status(201).json({ success: true, data: order });
});

/**
 * Get recent orders.
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getRecentOrders();
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
    const order = await orderService.getOrderByTable(tableId);
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

    const order = await orderService.addItemsToOrder(orderId, items, serverId);
    res.json({ success: true, data: order });
});

/**
 * Get active delivery orders.
 */
export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    logger.debug('getDeliveryOrders requested', { userId: req.user?.id });
    const orders = await orderService.getDeliveryOrders();
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

    const order = await orderService.assignDriver(orderId, Number(driverId));
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

    const order = await orderService.markAllItemsServed(orderId);
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
    
    const result = await orderVoidService.voidItem(
        {
            orderItemId: itemId,
            reason: data.reason as VoidReason,
            notes: data.notes
        },
        {
            userId: req.user?.id,
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
    
    const result = await orderTransferService.transferItems(
        data.itemIds,
        data.fromTableId,
        data.toTableId,
        {
            userId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    );
    
    res.json({ success: true, data: result });
});

