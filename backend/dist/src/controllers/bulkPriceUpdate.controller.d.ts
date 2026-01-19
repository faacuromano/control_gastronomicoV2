/**
 * Bulk Price Update Controller
 * Endpoints for mass price updates
 */
import { Request, Response } from 'express';
/**
 * GET /api/v1/bulk-prices/products
 * Get all products for the price update grid
 */
export declare const getProductsForGrid: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/v1/bulk-prices/categories
 * Get categories for filter dropdown
 */
export declare const getCategories: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/v1/bulk-prices/preview
 * Preview price changes without applying
 */
export declare const previewChanges: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/v1/bulk-prices/apply
 * Apply bulk price updates
 */
export declare const applyUpdates: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/v1/bulk-prices/category/:categoryId
 * Update all prices in a category by percentage/fixed amount
 */
export declare const updateByCategory: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=bulkPriceUpdate.controller.d.ts.map