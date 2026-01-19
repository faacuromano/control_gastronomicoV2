"use strict";
/**
 * Discount Controller
 * Endpoints for applying and managing order discounts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscountTypes = exports.getDiscountReasons = exports.removeDiscount = exports.applyDiscount = void 0;
const discount_service_1 = require("../services/discount.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const ApplyDiscountSchema = zod_1.z.object({
    orderId: zod_1.z.number().int().positive(),
    type: zod_1.z.enum(['PERCENTAGE', 'FIXED']),
    value: zod_1.z.number().positive(),
    reason: zod_1.z.enum(['EMPLOYEE', 'VIP_CUSTOMER', 'PROMOTION', 'COMPLAINT', 'MANAGER_COURTESY', 'LOYALTY', 'OTHER']),
    notes: zod_1.z.string().optional(),
    authorizerId: zod_1.z.number().int().positive().optional()
});
/**
 * POST /api/v1/discounts/apply
 * Apply a discount to an order
 */
exports.applyDiscount = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const validation = ApplyDiscountSchema.safeParse(req.body);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid input', validation.error.issues);
    }
    const data = validation.data;
    // Build input object carefully to avoid undefined values with exactOptionalPropertyTypes
    const input = {
        orderId: data.orderId,
        type: data.type,
        value: data.value,
        reason: data.reason
    };
    if (data.notes !== undefined)
        input.notes = data.notes;
    if (data.authorizerId !== undefined)
        input.authorizerId = data.authorizerId;
    const ip = String(req.ip || 'unknown');
    const result = await discount_service_1.discountService.applyDiscount(input, {
        userId: req.user?.id,
        ipAddress: ip
    });
    res.json({ success: true, data: result });
});
/**
 * DELETE /api/v1/discounts/:orderId
 * Remove discount from an order
 */
exports.removeDiscount = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = parseInt(String(req.params.orderId));
    if (isNaN(orderId)) {
        throw new errors_1.ValidationError('Invalid order ID');
    }
    const ip = String(req.ip || 'unknown');
    const result = await discount_service_1.discountService.removeDiscount(orderId, {
        userId: req.user?.id,
        ipAddress: ip
    });
    res.json({ success: true, data: result });
});
/**
 * GET /api/v1/discounts/reasons
 * Get available discount reasons for UI
 */
exports.getDiscountReasons = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const reasons = discount_service_1.discountService.getDiscountReasons();
    res.json({ success: true, data: reasons });
});
/**
 * GET /api/v1/discounts/types
 * Get available discount types for UI
 */
exports.getDiscountTypes = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const types = discount_service_1.discountService.getDiscountTypes();
    res.json({ success: true, data: types });
});
//# sourceMappingURL=discount.controller.js.map