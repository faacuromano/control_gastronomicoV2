/**
 * @fileoverview Controlador de Descuentos
 *
 * Gestiona la aplicación y remoción de descuentos sobre órdenes.
 * Soporta descuentos porcentuales y de monto fijo, con motivos tipificados
 * (empleado, VIP, promoción, queja, cortesía, fidelidad, otro).
 * Cada operación se audita con el usuario y su IP.
 *
 * @module controllers/discount.controller
 */

import { Request, Response } from 'express';
import { discountService, type ApplyDiscountInput } from '../services/discount.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

/**
 * Esquema de validación para aplicar un descuento a una orden.
 * El refinamiento garantiza que un descuento porcentual no supere el 100%.
 */
const ApplyDiscountSchema = z.object({
    orderId: z.number().int().positive(),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number().positive(),
    reason: z.enum(['EMPLOYEE', 'VIP_CUSTOMER', 'PROMOTION', 'COMPLAINT', 'MANAGER_COURTESY', 'LOYALTY', 'OTHER']),
    notes: z.string().optional(),
    authorizerId: z.number().int().positive().optional()
}).refine(
    (data) => data.type !== 'PERCENTAGE' || data.value <= 100,
    { message: 'Percentage discount cannot exceed 100%', path: ['value'] }
);

/**
 * POST /api/v1/discounts/apply
 * Aplica un descuento a una orden existente.
 * Construye el input cuidadosamente para evitar valores undefined con exactOptionalPropertyTypes.
 */
export const applyDiscount = asyncHandler(async (req: Request, res: Response) => {
    const validation = ApplyDiscountSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const data = validation.data;

    // Construir objeto input evitando propiedades undefined (requerido por exactOptionalPropertyTypes)
    const input: ApplyDiscountInput = {
        orderId: data.orderId,
        type: data.type,
        value: data.value,
        reason: data.reason
    };

    if (data.notes !== undefined) input.notes = data.notes;
    if (data.authorizerId !== undefined) input.authorizerId = data.authorizerId;

    const ip = String(req.ip || 'unknown');

    const result = await discountService.applyDiscount(
        input,
        req.user!.tenantId!,
        {
            userId: req.user!.id,
            ipAddress: ip
        }
    );

    sendSuccess(res, result );
});

/**
 * DELETE /api/v1/discounts/:orderId
 * Remueve el descuento de una orden (lo revierte al total original).
 */
export const removeDiscount = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(String(req.params.orderId));
    if (isNaN(orderId)) {
        throw new ValidationError('Invalid order ID');
    }

    const ip = String(req.ip || 'unknown');
    const result = await discountService.removeDiscount(
        orderId,
        req.user!.tenantId!,
        {
            userId: req.user!.id,
            ipAddress: ip
        }
    );

    sendSuccess(res, result );
});

/**
 * GET /api/v1/discounts/reasons
 * Devuelve los motivos de descuento disponibles para poblar el dropdown en la UI.
 */
export const getDiscountReasons = asyncHandler(async (req: Request, res: Response) => {
    const reasons = discountService.getDiscountReasons();
    sendSuccess(res, reasons );
});

/**
 * GET /api/v1/discounts/types
 * Devuelve los tipos de descuento disponibles (PERCENTAGE, FIXED) para la UI.
 */
export const getDiscountTypes = asyncHandler(async (req: Request, res: Response) => {
    const types = discountService.getDiscountTypes();
    sendSuccess(res, types );
});
