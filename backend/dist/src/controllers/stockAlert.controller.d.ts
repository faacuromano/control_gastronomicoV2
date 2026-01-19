/**
 * Stock Alert Controller
 * Endpoints for stock alerts management
 */
import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/v1/stock-alerts
 * Get all items currently below minimum stock
 */
export declare const getLowStockItems: (req: Request, res: Response, next: NextFunction) => void;
/**
 * POST /api/v1/stock-alerts/broadcast
 * Broadcast current low stock status to all connected clients
 */
export declare const broadcastStatus: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=stockAlert.controller.d.ts.map