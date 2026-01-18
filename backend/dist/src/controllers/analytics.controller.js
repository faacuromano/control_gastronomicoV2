"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailySales = exports.getLowStockItems = exports.getSalesByChannel = exports.getPaymentBreakdown = exports.getTopProducts = exports.getSalesSummary = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const analytics_service_1 = require("../services/analytics.service");
/**
 * Parse date range from query params
 */
const dateRangeSchema = zod_1.z.object({
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional()
});
function parseDateRange(query) {
    const { startDate, endDate } = dateRangeSchema.parse(query);
    if (!startDate || !endDate) {
        return undefined;
    }
    // Parse start date at beginning of day (in local timezone)
    // Using Date(year, month, day) creates a date in LOCAL time, not UTC
    const startParts = startDate.split('-').map(Number);
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
    // Parse end date at END of day (23:59:59.999) in local timezone
    const endParts = endDate.split('-').map(Number);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);
    return {
        startDate: start,
        endDate: end
    };
}
/**
 * Get today's date range
 */
function getTodayRange() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { startDate, endDate };
}
/**
 * Get sales summary
 */
exports.getSalesSummary = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const range = parseDateRange(req.query) || getTodayRange();
    const summary = await analytics_service_1.analyticsService.getSalesSummary(range);
    res.json({ success: true, data: summary });
});
/**
 * Get top products
 */
exports.getTopProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const range = parseDateRange(req.query);
    const products = await analytics_service_1.analyticsService.getTopProducts(limit, range);
    res.json({ success: true, data: products });
});
/**
 * Get payment method breakdown
 */
exports.getPaymentBreakdown = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const range = parseDateRange(req.query);
    const breakdown = await analytics_service_1.analyticsService.getPaymentBreakdown(range);
    res.json({ success: true, data: breakdown });
});
/**
 * Get sales by channel
 */
exports.getSalesByChannel = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const range = parseDateRange(req.query);
    const channels = await analytics_service_1.analyticsService.getSalesByChannel(range);
    res.json({ success: true, data: channels });
});
/**
 * Get low stock items
 */
exports.getLowStockItems = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const items = await analytics_service_1.analyticsService.getLowStockItems();
    res.json({ success: true, data: items });
});
/**
 * Get daily sales for charts
 */
exports.getDailySales = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // Default to last 30 days if no range provided
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const range = parseDateRange(req.query) || { startDate: defaultStart, endDate: now };
    const sales = await analytics_service_1.analyticsService.getDailySales(range);
    res.json({ success: true, data: sales });
});
//# sourceMappingURL=analytics.controller.js.map