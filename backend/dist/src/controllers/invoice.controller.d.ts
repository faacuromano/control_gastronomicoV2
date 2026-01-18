import { Request, Response } from 'express';
/**
 * Generate invoice for an order
 * POST /invoices
 */
export declare const generateInvoice: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get invoice by order ID
 * GET /invoices/order/:orderId
 */
export declare const getByOrderId: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get invoice by invoice number
 * GET /invoices/:invoiceNumber
 */
export declare const getByInvoiceNumber: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get all invoices with optional filters
 * GET /invoices
 */
export declare const getAll: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=invoice.controller.d.ts.map