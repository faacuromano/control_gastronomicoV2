import { Request, Response } from 'express';
/**
 * Generate ticket buffer (for local/browser printing)
 * GET /print/:id
 */
export declare const printTicket: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Print order to a specific thermal printer device
 * POST /print/:orderId/device/:printerId
 */
export declare const printToDevice: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Print test page to verify printer connection
 * POST /print/test/:printerId
 */
export declare const printTestPage: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get all configured printers
 * GET /print/printers
 */
export declare const getPrinters: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get available Windows system printers
 * GET /print/printers/system
 */
export declare const getSystemPrinters: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create a new printer
 * POST /print/printers
 */
export declare const createPrinter: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update printer
 * PUT /print/printers/:id
 */
export declare const updatePrinter: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Delete printer
 * DELETE /print/printers/:id
 */
export declare const deletePrinter: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=printer.controller.d.ts.map