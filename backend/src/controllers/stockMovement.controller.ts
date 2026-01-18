/**
 * @fileoverview Stock Movement Controller
 * Handles HTTP requests for inventory stock movements.
 * 
 * @module controllers/stockMovement.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { StockMovementService } from '../services/stockMovement.service';
import { StockMoveType } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';

const stockService = new StockMovementService();

// Validation Schema
const movementSchema = z.object({
  ingredientId: z.number().int().positive(),
  type: z.nativeEnum(StockMoveType),
  quantity: z.number(), // Allow negative for ADJUSTMENT
  reason: z.string().optional()
});

export const registerMovement = asyncHandler(async (req: Request, res: Response) => {
    const data = movementSchema.parse(req.body);
    
    // Logic check: only ADJUSTMENT allows negative
    if (data.type !== 'ADJUSTMENT' && data.quantity < 0) {
        return res.status(400).json({ success: false, error: "Quantity must be positive for PURCHASE/SALE/WASTE" });
    }

    const result = await stockService.register(data.ingredientId, data.type, data.quantity, data.reason);
    res.status(201).json({ success: true, data: result });
});

export const getMovementHistory = asyncHandler(async (req: Request, res: Response) => {
    const ingredientId = req.query.ingredientId ? parseInt(req.query.ingredientId as string) : undefined;
    const history = await stockService.getHistory(ingredientId);
    res.json({ success: true, data: history });
});
