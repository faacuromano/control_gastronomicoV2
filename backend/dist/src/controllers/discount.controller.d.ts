/**
 * Discount Controller
 * Endpoints for applying and managing order discounts
 */
import { Request, Response } from 'express';
/**
 * POST /api/v1/discounts/apply
 * Apply a discount to an order
 */
export declare const applyDiscount: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /api/v1/discounts/:orderId
 * Remove discount from an order
 */
export declare const removeDiscount: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/v1/discounts/reasons
 * Get available discount reasons for UI
 */
export declare const getDiscountReasons: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/v1/discounts/types
 * Get available discount types for UI
 */
export declare const getDiscountTypes: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=discount.controller.d.ts.map