import { Request, Response } from 'express';
/**
 * Get all purchase orders
 */
export declare const getPurchaseOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get purchase order by ID
 */
export declare const getPurchaseOrderById: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create new purchase order
 */
export declare const createPurchaseOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update purchase order status
 */
export declare const updatePurchaseOrderStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Receive purchase order (updates stock)
 */
export declare const receivePurchaseOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Cancel purchase order
 */
export declare const cancelPurchaseOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Delete purchase order
 */
export declare const deletePurchaseOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=purchaseOrder.controller.d.ts.map