"use strict";
/**
 * @fileoverview Print Routing Controller.
 * Handles HTTP requests for print routing configuration.
 *
 * @module controllers/printRouting.controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAreaOverride = exports.setAreaOverride = exports.setCategoryPrinter = exports.getOrderRouting = exports.getConfiguration = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const printRouting_service_1 = require("../services/printRouting.service");
const logger_1 = require("../utils/logger");
/**
 * Get print routing configuration (for admin UI).
 */
exports.getConfiguration = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const config = await printRouting_service_1.printRoutingService.getRoutingConfiguration();
    res.json({ success: true, data: config });
});
/**
 * Get routing preview for an order.
 */
exports.getOrderRouting = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }
    const routing = await printRouting_service_1.printRoutingService.getRoutingForOrder(orderId);
    res.json({ success: true, data: routing });
});
/**
 * Zod schema for setting category printer.
 */
const setCategoryPrinterSchema = zod_1.z.object({
    printerId: zod_1.z.number().int().positive().nullable()
});
/**
 * Set category default printer.
 */
exports.setCategoryPrinter = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const categoryId = Number(req.params.categoryId);
    if (isNaN(categoryId)) {
        return res.status(400).json({ success: false, error: 'Invalid category ID' });
    }
    const { printerId } = setCategoryPrinterSchema.parse(req.body);
    const category = await printRouting_service_1.printRoutingService.setCategoryPrinter(categoryId, printerId);
    logger_1.logger.info('Category printer updated', { categoryId, printerId });
    res.json({ success: true, data: category });
});
/**
 * Zod schema for setting area override.
 */
const setAreaOverrideSchema = zod_1.z.object({
    categoryId: zod_1.z.number().int().positive().nullable(),
    printerId: zod_1.z.number().int().positive()
});
/**
 * Set area printer override.
 */
exports.setAreaOverride = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const areaId = Number(req.params.areaId);
    if (isNaN(areaId)) {
        return res.status(400).json({ success: false, error: 'Invalid area ID' });
    }
    const { categoryId, printerId } = setAreaOverrideSchema.parse(req.body);
    const override = await printRouting_service_1.printRoutingService.setAreaOverride(areaId, categoryId, printerId);
    logger_1.logger.info('Area printer override set', { areaId, categoryId, printerId });
    res.json({ success: true, data: override });
});
/**
 * Zod schema for removing area override.
 */
const removeAreaOverrideSchema = zod_1.z.object({
    categoryId: zod_1.z.number().int().positive().nullable()
});
/**
 * Remove area printer override.
 */
exports.removeAreaOverride = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const areaId = Number(req.params.areaId);
    if (isNaN(areaId)) {
        return res.status(400).json({ success: false, error: 'Invalid area ID' });
    }
    const { categoryId } = removeAreaOverrideSchema.parse(req.body);
    await printRouting_service_1.printRoutingService.removeAreaOverride(areaId, categoryId);
    logger_1.logger.info('Area printer override removed', { areaId, categoryId });
    res.json({ success: true, message: 'Override removed' });
});
//# sourceMappingURL=printRouting.controller.js.map