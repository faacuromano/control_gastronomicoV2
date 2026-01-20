/**
 * @fileoverview Sync Controller for offline synchronization
 * Endpoints for pull (get data) and push (sync offline operations)
 * 
 * @module controllers/sync.controller
 */

import { Request, Response } from 'express';
import { syncService } from '../services/sync.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';
import type { SyncPushRequest } from '../types/sync.types';

// Validation schemas
const PendingOrderItemSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
    modifiers: z.array(z.object({
        id: z.number().int().positive(),
        price: z.coerce.number() // Accept strings and convert to numbers (e.g., "1.5" → 1.5)
    })).optional(),
    removedIngredientIds: z.array(z.number().int()).optional()
});

const PendingOrderSchema = z.object({
    tempId: z.string().min(1),
    items: z.array(PendingOrderItemSchema).min(1),
    channel: z.enum(['POS', 'DELIVERY_APP', 'WAITER_APP', 'QR_MENU']),
    tableId: z.number().int().positive().optional(),
    clientId: z.number().int().positive().optional(),
    createdAt: z.string().datetime(),
    shiftId: z.number().int().positive().optional()
});

const PendingPaymentSchema = z.object({
    tempOrderId: z.string().min(1),
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'WALLET', 'OTHER']),
    amount: z.number().positive(),
    createdAt: z.string().datetime()
});

const SyncPushRequestSchema = z.object({
    clientId: z.string().min(1),
    pendingOrders: z.array(PendingOrderSchema),
    pendingPayments: z.array(PendingPaymentSchema)
});

/**
 * GET /api/v1/sync/pull
 * Pull all data needed for offline operation
 */
export const pull = asyncHandler(async (req: Request, res: Response) => {
    const data = await syncService.pull();
    
    res.json({
        success: true,
        data
    });
});

/**
 * POST /api/v1/sync/push
 * Push offline operations to server
 */
export const push = asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const validation = SyncPushRequestSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid sync request', validation.error.issues);
    }

    // Get user from auth middleware
    const userId = (req as any).user?.id;
    if (!userId) {
        throw new ValidationError('User authentication required for sync');
    }

    const ip = String(req.ip || 'unknown');
    
    const result = await syncService.push(
        validation.data as SyncPushRequest,
        {
            userId,
            ipAddress: ip
        }
    );

    res.json({
        success: result.success,
        data: result
    });
});

/**
 * GET /api/v1/sync/status
 * Check sync status and server time
 */
export const status = asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            serverTime: new Date().toISOString(),
            online: true
        }
    });
});
