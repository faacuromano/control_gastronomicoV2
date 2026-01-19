"use strict";
/**
 * @fileoverview Order controller.
 * Handles HTTP requests for order operations.
 *
 * @module controllers/order.controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferItems = exports.getVoidReasons = exports.voidItem = exports.markAllItemsServed = exports.assignDriver = exports.getDeliveryOrders = exports.addItemsToOrder = exports.getOrderByTable = exports.getOrders = exports.createOrder = exports.getActiveOrders = exports.updateItemStatus = exports.updateStatus = void 0;
const zod_1 = require("zod");
const order_service_1 = require("../services/order.service");
const client_1 = require("@prisma/client");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const orderService = new order_service_1.OrderService();
/**
 * Zod schema for order creation validation.
 */
const createOrderSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().optional(),
        modifiers: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.number().int().positive(),
            price: zod_1.z.coerce.number() // Accept string from Prisma Decimal
        })).optional(),
        removedIngredientIds: zod_1.z.array(zod_1.z.number().int().positive()).optional()
    })).min(1, "Order must have at least one item"),
    channel: zod_1.z.nativeEnum(client_1.OrderChannel).optional(),
    tableId: zod_1.z.number().int().optional(),
    clientId: zod_1.z.number().int().optional(),
    // Accept PaymentMethod enum values OR 'SPLIT' for split payments
    paymentMethod: zod_1.z.union([zod_1.z.nativeEnum(client_1.PaymentMethod), zod_1.z.literal('SPLIT')]).optional(),
    // Accept any string for method to support dynamic payment method codes (CASH, CARD, DEBIT, TRANSFER, etc.)
    payments: zod_1.z.array(zod_1.z.object({
        method: zod_1.z.string().min(1), // Dynamic payment method codes
        amount: zod_1.z.number().positive()
    })).optional(),
    deliveryData: zod_1.z.object({
        address: zod_1.z.string(),
        notes: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        driverId: zod_1.z.number().int().optional(),
    }).optional(),
});
/**
 * Zod schema for adding items to an existing order.
 */
const addItemsSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().optional(),
        modifiers: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.number().int().positive(),
            price: zod_1.z.coerce.number() // Accept string from Prisma Decimal
        })).optional(),
        removedIngredientIds: zod_1.z.array(zod_1.z.number().int().positive()).optional()
    })).min(1, "Must add at least one item")
});
/**
 * Zod schema for order status update.
 */
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.OrderStatus)
});
/**
 * Zod schema for item status update.
 */
const updateItemStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'COOKING', 'READY', 'SERVED'])
});
/**
 * Update order status.
 */
exports.updateStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status } = updateStatusSchema.parse(req.body);
    const order = await orderService.updateStatus(Number(req.params.id), status);
    res.json({ success: true, data: order });
});
/**
 * Update individual order item status.
 */
exports.updateItemStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status } = updateItemStatusSchema.parse(req.body);
    const item = await orderService.updateItemStatus(Number(req.params.itemId), status);
    res.json({ success: true, data: item });
});
/**
 * Get active orders for KDS.
 */
exports.getActiveOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orders = await orderService.getActiveOrders();
    res.json({ success: true, data: orders });
});
/**
 * Create a new order.
 */
exports.createOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    // Get serverId from authenticated user (typed via express.d.ts)
    const serverId = req.user?.id;
    if (!serverId) {
        throw new errors_1.UnauthorizedError('User ID required');
    }
    // Build properly typed order input - map items explicitly to match CreateOrderInput
    const orderInput = {
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
exports.getOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orders = await orderService.getRecentOrders();
    res.json({ success: true, data: orders });
});
/**
 * Get order by table ID.
 */
exports.getOrderByTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const tableId = Number(req.params.tableId);
    if (isNaN(tableId)) {
        return res.status(400).json({ success: false, error: 'Invalid table ID' });
    }
    const order = await orderService.getOrderByTable(tableId);
    res.json({ success: true, data: order });
});
/**
 * Add items to an existing order.
 */
exports.addItemsToOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }
    const data = addItemsSchema.parse(req.body);
    const serverId = req.user?.id;
    if (!serverId) {
        throw new errors_1.UnauthorizedError();
    }
    // Map Zod parsed items to OrderItemInput - types are compatible
    const items = data.items.map(item => ({
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
exports.getDeliveryOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    logger_1.logger.debug('getDeliveryOrders requested', { userId: req.user?.id });
    const orders = await orderService.getDeliveryOrders();
    logger_1.logger.debug('getDeliveryOrders result', { count: orders.length });
    res.json({ success: true, data: orders });
});
/**
 * Assign driver to order.
 */
exports.assignDriver = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = Number(req.params.id);
    const { driverId } = req.body;
    if (isNaN(orderId))
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    if (!driverId)
        return res.status(400).json({ success: false, error: 'Driver ID required' });
    const order = await orderService.assignDriver(orderId, Number(driverId));
    res.json({ success: true, data: order });
});
/**
 * Mark all items in an order as SERVED.
 * Used by kitchen when table order is ready for pickup by waiter.
 */
exports.markAllItemsServed = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }
    const order = await orderService.markAllItemsServed(orderId);
    res.json({ success: true, data: order });
});
// =============================================================================
// PHASE 2: VOID & TRANSFER OPERATIONS
// =============================================================================
const orderVoid_service_1 = require("../services/orderVoid.service");
const orderTransfer_service_1 = require("../services/orderTransfer.service");
/**
 * Zod schema for void item validation.
 */
const voidItemSchema = zod_1.z.object({
    reason: zod_1.z.enum(orderVoid_service_1.VOID_REASONS),
    notes: zod_1.z.string().optional()
});
/**
 * Void (cancel) an order item.
 * Requires orders:delete permission (manager action).
 */
exports.voidItem = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const itemId = Number(req.params.itemId);
    if (isNaN(itemId)) {
        return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }
    const data = voidItemSchema.parse(req.body);
    const result = await orderVoid_service_1.orderVoidService.voidItem({
        orderItemId: itemId,
        reason: data.reason,
        notes: data.notes
    }, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    res.json({ success: true, data: result });
});
/**
 * Get available void reasons for UI dropdown.
 */
exports.getVoidReasons = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const reasons = orderVoid_service_1.orderVoidService.getVoidReasons();
    res.json({ success: true, data: reasons });
});
/**
 * Zod schema for transfer items validation.
 */
const transferItemsSchema = zod_1.z.object({
    itemIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
    fromTableId: zod_1.z.number().int().positive(),
    toTableId: zod_1.z.number().int().positive()
});
/**
 * Transfer items between tables.
 */
exports.transferItems = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = transferItemsSchema.parse(req.body);
    const result = await orderTransfer_service_1.orderTransferService.transferItems(data.itemIds, data.fromTableId, data.toTableId, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    res.json({ success: true, data: result });
});
//# sourceMappingURL=order.controller.js.map