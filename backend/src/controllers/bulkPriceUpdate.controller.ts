/**
 * Bulk Price Update Controller
 * Endpoints for mass price updates
 */

import { Request, Response } from 'express';
import { bulkPriceUpdateService, type PriceUpdateType } from '../services/bulkPriceUpdate.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

const BulkUpdateSchema = z.object({
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number(),
    round: z.boolean().optional()
});

const ApplyUpdatesSchema = z.object({
    updates: z.array(z.object({
        id: z.number().int().positive(),
        newPrice: z.number().min(0)
    }))
});

/**
 * GET /api/v1/bulk-prices/products
 * Get all products for the price update grid
 */
export const getProductsForGrid = asyncHandler(async (req: Request, res: Response) => {
    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;
    const products = await bulkPriceUpdateService.getProductsForPriceGrid({ categoryId });
    res.json({ success: true, data: products });
});

/**
 * GET /api/v1/bulk-prices/categories
 * Get categories for filter dropdown
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await bulkPriceUpdateService.getCategories();
    res.json({ success: true, data: categories });
});

/**
 * POST /api/v1/bulk-prices/preview
 * Preview price changes without applying
 */
export const previewChanges = asyncHandler(async (req: Request, res: Response) => {
    const validation = BulkUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;
    const products = await bulkPriceUpdateService.getProductsForPriceGrid({ categoryId });
    const previewed = bulkPriceUpdateService.previewBulkUpdate(products, validation.data);

    res.json({ success: true, data: previewed });
});

/**
 * POST /api/v1/bulk-prices/apply
 * Apply bulk price updates
 */
export const applyUpdates = asyncHandler(async (req: Request, res: Response) => {
    const validation = ApplyUpdatesSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const ip = String(req.ip || 'unknown');
    const result = await bulkPriceUpdateService.applyBulkUpdate(
        validation.data.updates,
        {
            userId: (req as any).user?.id,
            ipAddress: ip
        }
    );

    res.json({ success: true, data: result });
});

/**
 * POST /api/v1/bulk-prices/category/:categoryId
 * Update all prices in a category by percentage/fixed amount
 */
export const updateByCategory = asyncHandler(async (req: Request, res: Response) => {
    const categoryId = parseInt(String(req.params.categoryId));
    if (isNaN(categoryId)) {
        throw new ValidationError('Invalid category ID');
    }

    const validation = BulkUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const ip = String(req.ip || 'unknown');
    const result = await bulkPriceUpdateService.updateByCategory(
        categoryId,
        validation.data,
        {
            userId: (req as any).user?.id,
            ipAddress: ip
        }
    );

    res.json({ success: true, data: result });
});
