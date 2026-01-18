import { Request, Response } from 'express';
/**
 * Get all payment methods (admin)
 */
export declare const getAll: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get active payment methods (for POS)
 */
export declare const getActive: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get by ID
 */
export declare const getById: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create new payment method
 */
export declare const create: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update payment method
 */
export declare const update: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Toggle active status
 */
export declare const toggleActive: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Delete payment method
 */
export declare const remove: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Seed default payment methods
 */
export declare const seedDefaults: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=paymentMethod.controller.d.ts.map