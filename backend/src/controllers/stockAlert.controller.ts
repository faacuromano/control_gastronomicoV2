/**
 * Stock Alert Controller
 * Endpoints for stock alerts management
 */

import { Request, Response, NextFunction } from 'express';
import { stockAlertService } from '../services/stockAlert.service';
import { asyncHandler } from '../middleware/asyncHandler';

/**
 * GET /api/v1/stock-alerts
 * Get all items currently below minimum stock
 */
export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
    const alerts = await stockAlertService.getLowStockItems(req.user!.tenantId!);
    res.json({
        success: true,
        data: alerts
    });
});

/**
 * POST /api/v1/stock-alerts/broadcast
 * Broadcast current low stock status to all connected clients
 */
export const broadcastStatus = asyncHandler(async (req: Request, res: Response) => {
    await stockAlertService.broadcastLowStockStatus(req.user!.tenantId!);
    res.json({
        success: true,
        message: 'Low stock status broadcasted to connected clients'
    });
});
