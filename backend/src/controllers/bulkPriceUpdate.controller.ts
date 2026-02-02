/**
 * @fileoverview Controlador de Actualización Masiva de Precios
 *
 * Permite a administradores actualizar precios de múltiples productos a la vez,
 * ya sea por porcentaje o monto fijo, con funcionalidad de vista previa antes
 * de aplicar los cambios. Esencial para ajustes por inflación o cambios de costos.
 *
 * @module controllers/bulkPriceUpdate.controller
 */

import { Request, Response } from 'express';
import { bulkPriceUpdateService, type PriceUpdateType } from '../services/bulkPriceUpdate.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

/**
 * Esquema de validación para la solicitud de actualización masiva.
 * - type: PERCENTAGE aplica un incremento/decremento porcentual; FIXED suma/resta un monto fijo.
 * - round: opcional, para redondear los precios resultantes.
 */
const BulkUpdateSchema = z.object({
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number(),
    round: z.boolean().optional()
});

/**
 * Esquema para aplicar actualizaciones individuales ya calculadas.
 * Cada entrada tiene el ID del producto y su nuevo precio definitivo.
 */
const ApplyUpdatesSchema = z.object({
    updates: z.array(z.object({
        id: z.number().int().positive(),
        newPrice: z.number().min(0)
    }))
});

/**
 * GET /api/v1/bulk-prices/products
 * Obtiene todos los productos del tenant formateados para la grilla de precios.
 * Opcionalmente filtra por categoría.
 */
export const getProductsForGrid = asyncHandler(async (req: Request, res: Response) => {
    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;
    const tenantId = req.user!.tenantId!;
    const products = await bulkPriceUpdateService.getProductsForPriceGrid(tenantId, { categoryId });
    sendSuccess(res, products);
});

/**
 * GET /api/v1/bulk-prices/categories
 * Obtiene las categorías para el dropdown de filtro en la UI de precios masivos.
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await bulkPriceUpdateService.getCategories(req.user!.tenantId!);
    sendSuccess(res, categories);
});

/**
 * POST /api/v1/bulk-prices/preview
 * Vista previa de cambios de precio sin aplicarlos a la base de datos.
 * El frontend muestra los precios actuales vs. propuestos para que el admin confirme.
 */
export const previewChanges = asyncHandler(async (req: Request, res: Response) => {
    const validation = BulkUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const tenantId = req.user!.tenantId!;
    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;
    const products = await bulkPriceUpdateService.getProductsForPriceGrid(tenantId, { categoryId });
    const previewed = bulkPriceUpdateService.previewBulkUpdate(products, validation.data);

    sendSuccess(res, previewed);
});

/**
 * POST /api/v1/bulk-prices/apply
 * Aplica las actualizaciones de precio confirmadas por el admin.
 * Registra auditoría con el usuario e IP que realizó el cambio.
 */
export const applyUpdates = asyncHandler(async (req: Request, res: Response) => {
    const validation = ApplyUpdatesSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const ip = String(req.ip || 'unknown');
    const result = await bulkPriceUpdateService.applyBulkUpdate(
        req.user!.tenantId!,
        validation.data.updates,
        {
            userId: req.user?.id,
            ipAddress: ip
        }
    );

    sendSuccess(res, result);
});

/**
 * POST /api/v1/bulk-prices/category/:categoryId
 * Actualiza todos los precios de una categoría específica por porcentaje o monto fijo.
 * Atajo para no tener que seleccionar productos individualmente.
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
        req.user!.tenantId!,
        categoryId,
        validation.data,
        {
            userId: req.user?.id,
            ipAddress: ip
        }
    );

    sendSuccess(res, result);
});
