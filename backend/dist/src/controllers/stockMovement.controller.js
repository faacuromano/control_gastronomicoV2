"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMovementHistory = exports.registerMovement = void 0;
const zod_1 = require("zod");
const stockMovement_service_1 = require("../services/stockMovement.service");
const client_1 = require("@prisma/client");
const stockService = new stockMovement_service_1.StockMovementService();
// Validation Schema
const movementSchema = zod_1.z.object({
    ingredientId: zod_1.z.number().int().positive(),
    type: zod_1.z.nativeEnum(client_1.StockMoveType),
    quantity: zod_1.z.number() // Allow negative for ADJUSTMENT
});
const registerMovement = async (req, res) => {
    try {
        const data = movementSchema.parse(req.body);
        // Logic check: only ADJUSTMENT allows negative
        if (data.type !== 'ADJUSTMENT' && data.quantity < 0) {
            return res.status(400).json({ success: false, error: "Quantity must be positive for PURCHASE/SALE/WASTE" });
        }
        const result = await stockService.register(data.ingredientId, data.type, data.quantity);
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ success: false, error: error.issues });
        }
        // Handle "Record to update not found." from prisma
        res.status(500).json({ success: false, error: error.message || 'Failed to register movement' });
    }
};
exports.registerMovement = registerMovement;
const getMovementHistory = async (req, res) => {
    try {
        const ingredientId = req.query.ingredientId ? parseInt(req.query.ingredientId) : undefined;
        const history = await stockService.getHistory(ingredientId);
        res.json({ success: true, data: history });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
};
exports.getMovementHistory = getMovementHistory;
//# sourceMappingURL=stockMovement.controller.js.map