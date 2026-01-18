"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePurchaseOrder = exports.cancelPurchaseOrder = exports.receivePurchaseOrder = exports.updatePurchaseOrderStatus = exports.createPurchaseOrder = exports.getPurchaseOrderById = exports.getPurchaseOrders = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const asyncHandler_1 = require("../middleware/asyncHandler");
const purchaseOrder_service_1 = require("../services/purchaseOrder.service");
/**
 * Zod schema for creating purchase order
 */
const createOrderSchema = zod_1.z.object({
    supplierId: zod_1.z.number().int().positive(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        ingredientId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().positive(),
        unitCost: zod_1.z.number().positive()
    })).min(1, 'La orden debe tener al menos un item')
});
/**
 * Zod schema for status update
 */
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.PurchaseStatus)
});
/**
 * Get all purchase orders
 */
exports.getPurchaseOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const status = req.query.status;
    const orders = await purchaseOrder_service_1.purchaseOrderService.getAll(status);
    res.json({ success: true, data: orders });
});
/**
 * Get purchase order by ID
 */
exports.getPurchaseOrderById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await purchaseOrder_service_1.purchaseOrderService.getById(id);
    res.json({ success: true, data: order });
});
/**
 * Create new purchase order
 */
exports.createPurchaseOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    // Type assertion needed due to Prisma exactOptionalPropertyTypes incompatibility
    const order = await purchaseOrder_service_1.purchaseOrderService.create(data);
    res.status(201).json({ success: true, data: order });
});
/**
 * Update purchase order status
 */
exports.updatePurchaseOrderStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = updateStatusSchema.parse(req.body);
    const order = await purchaseOrder_service_1.purchaseOrderService.updateStatus(id, status);
    res.json({ success: true, data: order });
});
/**
 * Receive purchase order (updates stock)
 */
exports.receivePurchaseOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await purchaseOrder_service_1.purchaseOrderService.receivePurchaseOrder(id);
    res.json({ success: true, data: order, message: 'Orden recibida y stock actualizado' });
});
/**
 * Cancel purchase order
 */
exports.cancelPurchaseOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await purchaseOrder_service_1.purchaseOrderService.cancel(id);
    res.json({ success: true, data: order });
});
/**
 * Delete purchase order
 */
exports.deletePurchaseOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await purchaseOrder_service_1.purchaseOrderService.delete(id);
    res.json({ success: true, message: 'Orden eliminada correctamente' });
});
//# sourceMappingURL=purchaseOrder.controller.js.map