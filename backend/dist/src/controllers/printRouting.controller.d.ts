/**
 * @fileoverview Print Routing Controller.
 * Handles HTTP requests for print routing configuration.
 *
 * @module controllers/printRouting.controller
 */
import { Request, Response } from 'express';
/**
 * Get print routing configuration (for admin UI).
 */
export declare const getConfiguration: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get routing preview for an order.
 */
export declare const getOrderRouting: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Set category default printer.
 */
export declare const setCategoryPrinter: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Set area printer override.
 */
export declare const setAreaOverride: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Remove area printer override.
 */
export declare const removeAreaOverride: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=printRouting.controller.d.ts.map