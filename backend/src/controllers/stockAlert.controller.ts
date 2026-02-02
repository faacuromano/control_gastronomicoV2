/**
 * @fileoverview Controlador de Alertas de Stock Bajo
 *
 * Provee endpoints para consultar ingredientes con stock por debajo del mínimo
 * configurado y para difundir el estado actual via Socket.IO a todos los clientes
 * conectados del tenant. Usado por el dashboard y las notificaciones en tiempo real.
 *
 * @module controllers/stockAlert.controller
 */

import { Request, Response, NextFunction } from 'express';
import { stockAlertService } from '../services/stockAlert.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

/**
 * GET /api/v1/stock-alerts
 * Obtiene todos los ingredientes cuyo stock actual está por debajo del mínimo.
 */
export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
    const alerts = await stockAlertService.getLowStockItems(req.user!.tenantId!);
    sendSuccess(res, alerts);
});

/**
 * POST /api/v1/stock-alerts/broadcast
 * Difunde el estado actual de stock bajo a todos los clientes conectados por Socket.IO.
 * Útil para forzar una actualización inmediata en todos los dashboards abiertos.
 */
export const broadcastStatus = asyncHandler(async (req: Request, res: Response) => {
    await stockAlertService.broadcastLowStockStatus(req.user!.tenantId!);
    sendSuccess(res, { message: 'Low stock status broadcasted to connected clients' });
});
