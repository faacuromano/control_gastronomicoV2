/**
 * Discount Controller
 * Endpoints for applying and managing order discounts
 */

import { Request, Response } from 'express';
import { discountService, type ApplyDiscountInput } from '../services/discount.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

const ApplyDiscountSchema = z.object({
    orderId: z.number().int().positive(),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number().positive(),
    reason: z.enum(['EMPLOYEE', 'VIP_CUSTOMER', 'PROMOTION', 'COMPLAINT', 'MANAGER_COURTESY', 'LOYALTY', 'OTHER']),
    notes: z.string().optional(),
    authorizerId: z.number().int().positive().optional()
});

/**
 * POST /api/v1/discounts/apply
 * Apply a discount to an order
 */
export const applyDiscount = asyncHandler(async (req: Request, res: Response) => {
    const validation = ApplyDiscountSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid input', validation.error.issues);
    }

    const data = validation.data;
    
    // Build input object carefully to avoid undefined values with exactOptionalPropertyTypes
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

    res.json({ success: true, data: result });
});

/**
 * DELETE /api/v1/discounts/:orderId
 * Remove discount from an order
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

    res.json({ success: true, data: result });
});

/**
 * GET /api/v1/discounts/reasons
 * Get available discount reasons for UI
 */
export const getDiscountReasons = asyncHandler(async (req: Request, res: Response) => {
    const reasons = discountService.getDiscountReasons();
    res.json({ success: true, data: reasons });
});

/**
 * GET /api/v1/discounts/types
 * Get available discount types for UI
 */
export const getDiscountTypes = asyncHandler(async (req: Request, res: Response) => {
    const types = discountService.getDiscountTypes();
    res.json({ success: true, data: types });
});
