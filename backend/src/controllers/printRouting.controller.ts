/**
 * @fileoverview Print Routing Controller.
 * Handles HTTP requests for print routing configuration.
 * 
 * @module controllers/printRouting.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { printRoutingService } from '../services/printRouting.service';
import { logger } from '../utils/logger';

/**
 * Get print routing configuration (for admin UI).
 */
export const getConfiguration = asyncHandler(async (_req: Request, res: Response) => {
    const config = await printRoutingService.getRoutingConfiguration();
    res.json({ success: true, data: config });
});

/**
 * Get routing preview for an order.
 */
export const getOrderRouting = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const routing = await printRoutingService.getRoutingForOrder(orderId);
    res.json({ success: true, data: routing });
});

/**
 * Zod schema for setting category printer.
 */
const setCategoryPrinterSchema = z.object({
    printerId: z.number().int().positive().nullable()
});

/**
 * Set category default printer.
 */
export const setCategoryPrinter = asyncHandler(async (req: Request, res: Response) => {
    const categoryId = Number(req.params.categoryId);
    if (isNaN(categoryId)) {
        return res.status(400).json({ success: false, error: 'Invalid category ID' });
    }

    const { printerId } = setCategoryPrinterSchema.parse(req.body);
    
    const category = await printRoutingService.setCategoryPrinter(categoryId, printerId);
    
    logger.info('Category printer updated', { categoryId, printerId });
    res.json({ success: true, data: category });
});

/**
 * Zod schema for setting area override.
 */
const setAreaOverrideSchema = z.object({
    categoryId: z.number().int().positive().nullable(),
    printerId: z.number().int().positive()
});

/**
 * Set area printer override.
 */
export const setAreaOverride = asyncHandler(async (req: Request, res: Response) => {
    const areaId = Number(req.params.areaId);
    if (isNaN(areaId)) {
        return res.status(400).json({ success: false, error: 'Invalid area ID' });
    }

    const { categoryId, printerId } = setAreaOverrideSchema.parse(req.body);
    
    const override = await printRoutingService.setAreaOverride(areaId, categoryId, printerId);
    
    logger.info('Area printer override set', { areaId, categoryId, printerId });
    res.json({ success: true, data: override });
});

/**
 * Zod schema for removing area override.
 */
const removeAreaOverrideSchema = z.object({
    categoryId: z.number().int().positive().nullable()
});

/**
 * Remove area printer override.
 */
export const removeAreaOverride = asyncHandler(async (req: Request, res: Response) => {
    const areaId = Number(req.params.areaId);
    if (isNaN(areaId)) {
        return res.status(400).json({ success: false, error: 'Invalid area ID' });
    }

    const { categoryId } = removeAreaOverrideSchema.parse(req.body);
    
    await printRoutingService.removeAreaOverride(areaId, categoryId);
    
    logger.info('Area printer override removed', { areaId, categoryId });
    res.json({ success: true, message: 'Override removed' });
});
