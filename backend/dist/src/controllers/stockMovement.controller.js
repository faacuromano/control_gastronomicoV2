"use strict";
/**
 * @fileoverview Stock Movement Controller
 * Handles HTTP requests for inventory stock movements.
 *
 * @module controllers/stockMovement.controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMovementHistory = exports.registerMovement = void 0;
const zod_1 = require("zod");
const stockMovement_service_1 = require("../services/stockMovement.service");
const client_1 = require("@prisma/client");
const asyncHandler_1 = require("../middleware/asyncHandler");
const stockService = new stockMovement_service_1.StockMovementService();
// Validation Schema
const movementSchema = zod_1.z.object({
    ingredientId: zod_1.z.number().int().positive(),
    type: zod_1.z.nativeEnum(client_1.StockMoveType),
    quantity: zod_1.z.number(), // Allow negative for ADJUSTMENT
    reason: zod_1.z.string().optional()
});
exports.registerMovement = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = movementSchema.parse(req.body);
    // Logic check: only ADJUSTMENT allows negative
    if (data.type !== 'ADJUSTMENT' && data.quantity < 0) {
        return res.status(400).json({ success: false, error: "Quantity must be positive for PURCHASE/SALE/WASTE" });
    }
    const result = await stockService.register(data.ingredientId, data.type, data.quantity, data.reason);
    res.status(201).json({ success: true, data: result });
});
exports.getMovementHistory = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const ingredientId = req.query.ingredientId ? parseInt(req.query.ingredientId) : undefined;
    const history = await stockService.getHistory(ingredientId);
    res.json({ success: true, data: history });
});
//# sourceMappingURL=stockMovement.controller.js.map