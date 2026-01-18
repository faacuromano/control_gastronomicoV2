"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaults = exports.remove = exports.toggleActive = exports.update = exports.create = exports.getById = exports.getActive = exports.getAll = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const paymentMethod_service_1 = require("../services/paymentMethod.service");
const createSchema = zod_1.z.object({
    code: zod_1.z.string().min(2).max(20),
    name: zod_1.z.string().min(2).max(50),
    icon: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional()
});
const updateSchema = createSchema.partial();
/**
 * Get all payment methods (admin)
 */
exports.getAll = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const methods = await paymentMethod_service_1.paymentMethodService.getAll();
    res.json({ success: true, data: methods });
});
/**
 * Get active payment methods (for POS)
 */
exports.getActive = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const methods = await paymentMethod_service_1.paymentMethodService.getActive();
    res.json({ success: true, data: methods });
});
/**
 * Get by ID
 */
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const method = await paymentMethod_service_1.paymentMethodService.getById(id);
    res.json({ success: true, data: method });
});
/**
 * Create new payment method
 */
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = createSchema.parse(req.body);
    const method = await paymentMethod_service_1.paymentMethodService.create(data);
    res.status(201).json({ success: true, data: method });
});
/**
 * Update payment method
 */
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const data = updateSchema.parse(req.body);
    const method = await paymentMethod_service_1.paymentMethodService.update(id, data);
    res.json({ success: true, data: method });
});
/**
 * Toggle active status
 */
exports.toggleActive = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const method = await paymentMethod_service_1.paymentMethodService.toggleActive(id);
    res.json({ success: true, data: method });
});
/**
 * Delete payment method
 */
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await paymentMethod_service_1.paymentMethodService.delete(id);
    res.json({ success: true, message: 'Payment method deleted' });
});
/**
 * Seed default payment methods
 */
exports.seedDefaults = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await paymentMethod_service_1.paymentMethodService.seedDefaults();
    res.json({ success: true, message: 'Default payment methods seeded' });
});
//# sourceMappingURL=paymentMethod.controller.js.map