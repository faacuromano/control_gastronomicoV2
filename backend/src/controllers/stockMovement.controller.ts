
import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { StockMovementService } from '../services/stockMovement.service';
import { StockMoveType } from '@prisma/client';

const stockService = new StockMovementService();

// Validation Schema
const movementSchema = z.object({
  ingredientId: z.number().int().positive(),
  type: z.nativeEnum(StockMoveType),
  quantity: z.number() // Allow negative for ADJUSTMENT
});

export const registerMovement = async (req: Request, res: Response) => {
  try {
    const data = movementSchema.parse(req.body);
    
    // Logic check: only ADJUSTMENT allows negative
    if (data.type !== 'ADJUSTMENT' && data.quantity < 0) {
        return res.status(400).json({ success: false, error: "Quantity must be positive for PURCHASE/SALE/WASTE" });
    }

    const result = await stockService.register(data.ingredientId, data.type, data.quantity);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    // Handle "Record to update not found." from prisma
    res.status(500).json({ success: false, error: (error as any).message || 'Failed to register movement' });
  }
};

export const getMovementHistory = async (req: Request, res: Response) => {
  try {
    const ingredientId = req.query.ingredientId ? parseInt(req.query.ingredientId as string) : undefined;
    const history = await stockService.getHistory(ingredientId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
};
