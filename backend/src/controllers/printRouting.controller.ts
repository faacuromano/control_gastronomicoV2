/**
 * @fileoverview Controlador de Ruteo de Impresión
 *
 * Configura hacia qué impresora se envía cada comanda según la categoría del producto
 * y el área del restaurante. Permite que los productos de "Bebidas" vayan a la impresora
 * del bar, los de "Platos principales" a la de cocina, y que un área como "Terraza"
 * pueda tener overrides que cambien estas asignaciones por defecto.
 *
 * Jerarquía de resolución:
 * 1. Override de área + categoría (si existe)
 * 2. Impresora por defecto de la categoría
 * 3. Sin impresora asignada (no se imprime automáticamente)
 *
 * @module controllers/printRouting.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { printRoutingService } from '../services/printRouting.service';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';

/** Obtiene la configuración completa de ruteo de impresión para el panel de admin */
export const getConfiguration = asyncHandler(async (req: Request, res: Response) => {
    const config = await printRoutingService.getRoutingConfiguration(req.user!.tenantId!);
    sendSuccess(res, config);
});

/**
 * Obtiene la vista previa de ruteo para una orden específica.
 * Muestra a qué impresora iría cada ítem de la orden según las reglas configuradas.
 */
export const getOrderRouting = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const routing = await printRoutingService.getRoutingForOrder(orderId, req.user!.tenantId!);
    return sendSuccess(res, routing);
});

/** Esquema para asignar la impresora por defecto de una categoría (null para desasignar) */
const setCategoryPrinterSchema = z.object({
    printerId: z.number().int().positive().nullable()
});

/**
 * Asigna o desasigna la impresora por defecto de una categoría.
 * Ej: Categoría "Bebidas" -> Impresora "Bar principal".
 */
export const setCategoryPrinter = asyncHandler(async (req: Request, res: Response) => {
    const categoryId = Number(req.params.categoryId);
    if (isNaN(categoryId)) {
        return res.status(400).json({ success: false, error: 'Invalid category ID' });
    }

    const { printerId } = setCategoryPrinterSchema.parse(req.body);

    const category = await printRoutingService.setCategoryPrinter(req.user!.tenantId!, categoryId, printerId);

    logger.info('Category printer updated', { categoryId, printerId });
    return sendSuccess(res, category);
});

/** Esquema para crear un override de impresora por área (null en categoryId = override global del área) */
const setAreaOverrideSchema = z.object({
    categoryId: z.number().int().positive().nullable(),
    printerId: z.number().int().positive()
});

/**
 * Establece un override de impresora para un área específica.
 * Permite que "Terraza" envíe los productos de "Bebidas" a una impresora diferente
 * a la configurada por defecto para esa categoría.
 */
export const setAreaOverride = asyncHandler(async (req: Request, res: Response) => {
    const areaId = Number(req.params.areaId);
    if (isNaN(areaId)) {
        return res.status(400).json({ success: false, error: 'Invalid area ID' });
    }

    const { categoryId, printerId } = setAreaOverrideSchema.parse(req.body);

    const override = await printRoutingService.setAreaOverride(req.user!.tenantId!, areaId, categoryId, printerId);

    logger.info('Area printer override set', { areaId, categoryId, printerId });
    return sendSuccess(res, override);
});

/** Esquema para eliminar un override de área (null en categoryId = override global) */
const removeAreaOverrideSchema = z.object({
    categoryId: z.number().int().positive().nullable()
});

/** Elimina un override de impresora de un área, volviendo al ruteo por defecto de categoría */
export const removeAreaOverride = asyncHandler(async (req: Request, res: Response) => {
    const areaId = Number(req.params.areaId);
    if (isNaN(areaId)) {
        return res.status(400).json({ success: false, error: 'Invalid area ID' });
    }

    const { categoryId } = removeAreaOverrideSchema.parse(req.body);

    await printRoutingService.removeAreaOverride(req.user!.tenantId!, areaId, categoryId);

    logger.info('Area printer override removed', { areaId, categoryId });
    return sendSuccess(res, { message: 'Override removed' });
});
