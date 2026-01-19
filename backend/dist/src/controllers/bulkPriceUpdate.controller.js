"use strict";
/**
 * Bulk Price Update Controller
 * Endpoints for mass price updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateByCategory = exports.applyUpdates = exports.previewChanges = exports.getCategories = exports.getProductsForGrid = void 0;
const bulkPriceUpdate_service_1 = require("../services/bulkPriceUpdate.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const BulkUpdateSchema = zod_1.z.object({
    type: zod_1.z.enum(['PERCENTAGE', 'FIXED']),
    value: zod_1.z.number(),
    round: zod_1.z.boolean().optional()
});
const ApplyUpdatesSchema = zod_1.z.object({
    updates: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.number().int().positive(),
        newPrice: zod_1.z.number().min(0)
    }))
});
/**
 * GET /api/v1/bulk-prices/products
 * Get all products for the price update grid
 */
exports.getProductsForGrid = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;
    const products = await bulkPriceUpdate_service_1.bulkPriceUpdateService.getProductsForPriceGrid({ categoryId });
    res.json({ success: true, data: products });
});
/**
 * GET /api/v1/bulk-prices/categories
 * Get categories for filter dropdown
 */
exports.getCategories = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const categories = await bulkPriceUpdate_service_1.bulkPriceUpdateService.getCategories();
    res.json({ success: true, data: categories });
});
/**
 * POST /api/v1/bulk-prices/preview
 * Preview price changes without applying
 */
exports.previewChanges = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const validation = BulkUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid input', validation.error.issues);
    }
    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;
    const products = await bulkPriceUpdate_service_1.bulkPriceUpdateService.getProductsForPriceGrid({ categoryId });
    const previewed = bulkPriceUpdate_service_1.bulkPriceUpdateService.previewBulkUpdate(products, validation.data);
    res.json({ success: true, data: previewed });
});
/**
 * POST /api/v1/bulk-prices/apply
 * Apply bulk price updates
 */
exports.applyUpdates = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const validation = ApplyUpdatesSchema.safeParse(req.body);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid input', validation.error.issues);
    }
    const ip = String(req.ip || 'unknown');
    const result = await bulkPriceUpdate_service_1.bulkPriceUpdateService.applyBulkUpdate(validation.data.updates, {
        userId: req.user?.id,
        ipAddress: ip
    });
    res.json({ success: true, data: result });
});
/**
 * POST /api/v1/bulk-prices/category/:categoryId
 * Update all prices in a category by percentage/fixed amount
 */
exports.updateByCategory = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const categoryId = parseInt(String(req.params.categoryId));
    if (isNaN(categoryId)) {
        throw new errors_1.ValidationError('Invalid category ID');
    }
    const validation = BulkUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid input', validation.error.issues);
    }
    const ip = String(req.ip || 'unknown');
    const result = await bulkPriceUpdate_service_1.bulkPriceUpdateService.updateByCategory(categoryId, validation.data, {
        userId: req.user?.id,
        ipAddress: ip
    });
    res.json({ success: true, data: result });
});
//# sourceMappingURL=bulkPriceUpdate.controller.js.map