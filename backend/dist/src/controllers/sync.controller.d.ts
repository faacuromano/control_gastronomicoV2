/**
 * @fileoverview Sync Controller for offline synchronization
 * Endpoints for pull (get data) and push (sync offline operations)
 *
 * @module controllers/sync.controller
 */
import { Request, Response } from 'express';
/**
 * GET /api/v1/sync/pull
 * Pull all data needed for offline operation
 */
export declare const pull: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/v1/sync/push
 * Push offline operations to server
 */
export declare const push: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/v1/sync/status
 * Check sync status and server time
 */
export declare const status: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=sync.controller.d.ts.map