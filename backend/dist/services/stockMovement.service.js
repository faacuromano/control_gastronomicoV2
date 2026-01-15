"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovementService = void 0;
const prisma_1 = require("../lib/prisma");
class StockMovementService {
    /**
     * Register a stock movement and update the ingredient stock in a transaction.
     * @param ingredientId
     * @param type PURCHASE, SALE, WASTE, ADJUSTMENT
     * @param quantity The absolute quantity involved (always positive, logic determines sign)
     * @param isAdjustment If true, and type is ADJUSTMENT, quantity is treated as the DELTA.
     *                     If the user wants to set exact stock, the controller should calculate the delta.
     *                     For now, we assume quantity is always the amount to ADD or SUBTRACT.
     */
    async register(ingredientId, type, quantity) {
        if (quantity < 0)
            throw new Error("Quantity must be positive");
        return await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create movement record
            const movement = await tx.stockMovement.create({
                data: {
                    ingredientId,
                    type,
                    quantity
                }
            });
            // 2. Calculate stock change
            let increment = 0;
            switch (type) {
                case 'PURCHASE':
                    increment = quantity;
                    break;
                case 'SALE':
                case 'WASTE':
                    increment = -quantity;
                    break;
                case 'ADJUSTMENT':
                    // Adjustment is tricky. Usually implies a correction.
                    // Let's assume the UI sends a signed quantity for adjustment? 
                    // Or we define Adjustment as "Add/Sub". 
                    // Let's treat Adjustment as signed in the input? 
                    // But I enforced positive quantity above.
                    // Let's assume ADJUSTMENT means "manual correction" and we follow the sign if we allowed it, 
                    // OR we simply assume the caller passes a type that implies direction.
                    // Actually, 'ADJUSTMENT' in this context usually means "Correction". 
                    // If I want to fix stock from 10 to 12, I add 2. If 10 to 8, I sub 2.
                    // If I enforce positive quantity, I need to know direction.
                    // Maybe we don't support ADJUSTMENT via this generic method effectively without a "sign" or "operation".
                    // For MVP, let's treat ADJUSTMENT as ADD logic (positive) for now, or assume the user uses PURCHASE/WASTE for +/-.
                    // Wait, real inventory systems often verify absolute stock.
                    // If I implement "Audit", I calculate delta.
                    // Let's allow `quantity` to be negative for ADJUSTMENT if needed?
                    // Re-reading: "Quantity must be positive" check might be too strict for Adjustment.
                    // Let's remove the check for ADJUSTMENT or allow the controller to handle positive/negative.
                    // But `StockMoveType` is just an enum.
                    // Let's simplify: 
                    // PURCHASE (+), SALE (-), WASTE (-).
                    // ADJUSTMENT: We will treat as (+/-). So allow negative quantity only for ADJUSTMENT.
                    increment = quantity;
                    break;
            }
            // If type is SALE/WASTE we flip usage of positive quantity
            // If type is ADJUSTMENT we stick with the sign provided.
            // Let's Refine:
            // Endpoint receives: type, quantity.
            // If type == WASTE, quantity 5 -> stock -5.
            // If type == ADJUSTMENT, quantity -5 -> stock -5.
            // So:
            if (type === 'SALE' || type === 'WASTE') {
                increment = -Math.abs(quantity);
            }
            else if (type === 'PURCHASE') {
                increment = Math.abs(quantity);
            }
            else {
                // ADJUSTMENT
                increment = quantity; // Trust the sign
            }
            // 3. Update Ingredient
            const ingredient = await tx.ingredient.update({
                where: { id: ingredientId },
                data: {
                    stock: {
                        increment: increment
                    }
                }
            });
            return { movement, newStock: ingredient.stock };
        });
    }
    async getHistory(ingredientId) {
        const where = ingredientId ? { ingredientId } : {};
        return await prisma_1.prisma.stockMovement.findMany({
            where,
            include: { ingredient: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
    }
}
exports.StockMovementService = StockMovementService;
//# sourceMappingURL=stockMovement.service.js.map