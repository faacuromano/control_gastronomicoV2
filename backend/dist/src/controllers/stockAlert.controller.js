"use strict";
/**
 * Stock Alert Controller
 * Endpoints for stock alerts management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastStatus = exports.getLowStockItems = void 0;
const stockAlert_service_1 = require("../services/stockAlert.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
/**
 * GET /api/v1/stock-alerts
 * Get all items currently below minimum stock
 */
exports.getLowStockItems = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const alerts = await stockAlert_service_1.stockAlertService.getLowStockItems();
    res.json({
        success: true,
        data: alerts
    });
});
/**
 * POST /api/v1/stock-alerts/broadcast
 * Broadcast current low stock status to all connected clients
 */
exports.broadcastStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await stockAlert_service_1.stockAlertService.broadcastLowStockStatus();
    res.json({
        success: true,
        message: 'Low stock status broadcasted to connected clients'
    });
});
//# sourceMappingURL=stockAlert.controller.js.map