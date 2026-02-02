/**
 * @fileoverview Controlador de Movimientos de Stock
 *
 * Registra y consulta los movimientos de inventario de ingredientes.
 * Tipos de movimiento:
 * - PURCHASE: Ingreso por compra a proveedor (incrementa stock)
 * - SALE: Descuento automático por venta de productos (decrementa stock)
 * - WASTE: Merma/desperdicio (decrementa stock)
 * - ADJUSTMENT: Ajuste manual positivo o negativo (único tipo que permite negativos)
 *
 * @module controllers/stockMovement.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { StockMovementService } from '../services/stockMovement.service';
import { StockMoveType } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

const stockService = new StockMovementService();

/**
 * Esquema de validación para registrar un movimiento de stock.
 * quantity permite negativos solo para ADJUSTMENT (validación adicional en el handler).
 */
const movementSchema = z.object({
  ingredientId: z.number().int().positive(),
  type: z.nativeEnum(StockMoveType),
  quantity: z.number(), // Permite negativos solo para ADJUSTMENT
  reason: z.string().optional()
});

/**
 * Registra un movimiento de stock manual.
 * Valida que solo ADJUSTMENT pueda tener cantidad negativa.
 */
export const registerMovement = asyncHandler(async (req: Request, res: Response) => {
    const data = movementSchema.parse(req.body);

    // Validación de negocio: solo ADJUSTMENT permite cantidades negativas
    if (data.type !== 'ADJUSTMENT' && data.quantity < 0) {
        return res.status(400).json({ success: false, error: "Quantity must be positive for PURCHASE/SALE/WASTE" });
    }

    const result = await stockService.register(data.ingredientId, req.user!.tenantId!, data.type, data.quantity, data.reason);
    return sendSuccess(res, result, undefined, 201);
});

/**
 * Obtiene el historial de movimientos de stock.
 * Opcionalmente filtra por ingrediente específico.
 */
export const getMovementHistory = asyncHandler(async (req: Request, res: Response) => {
    const ingredientId = req.query.ingredientId ? parseInt(req.query.ingredientId as string) : undefined;
    const history = await stockService.getHistory(req.user!.tenantId!, ingredientId);
    sendSuccess(res, history);
});
