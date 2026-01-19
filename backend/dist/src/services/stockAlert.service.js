"use strict";
/**
 * Stock Alert Service
 * Monitors stock levels and emits WebSocket alerts when below threshold
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockAlertService = void 0;
const prisma_1 = require("../lib/prisma");
const socket_1 = require("../lib/socket");
const logger_1 = require("../utils/logger");
class StockAlertService {
    /**
     * Check if ingredient is below minimum stock and emit alert if so
     */
    async checkAndAlert(ingredientId, newStock) {
        try {
            const ingredient = await prisma_1.prisma.ingredient.findUnique({
                where: { id: ingredientId }
            });
            if (!ingredient)
                return;
            const minStock = Number(ingredient.minStock);
            const currentStock = Number(newStock);
            // Only alert if minStock is configured (> 0)
            if (minStock <= 0)
                return;
            if (currentStock <= minStock) {
                const alert = {
                    id: Date.now(),
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    currentStock,
                    minStock,
                    unit: ingredient.unit,
                    severity: currentStock <= 0 ? 'critical' : 'warning',
                    timestamp: new Date()
                };
                this.emitAlert(alert);
                logger_1.logger.info('Stock alert emitted', {
                    ingredient: ingredient.name,
                    current: currentStock,
                    min: minStock
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to check stock alert', { ingredientId, error });
        }
    }
    /**
     * Emit stock alert via WebSocket to admin:stock room
     */
    emitAlert(alert) {
        try {
            const io = (0, socket_1.getIO)();
            io.to('admin:stock').emit('stock:low', alert);
        }
        catch (error) {
            logger_1.logger.error('Failed to emit stock alert', { error });
        }
    }
    /**
     * Get all ingredients currently below minimum stock
     */
    async getLowStockItems() {
        const ingredients = await prisma_1.prisma.$queryRaw `
            SELECT id, name, CAST(stock AS DECIMAL(10,2)) as stock, 
                   CAST(minStock AS DECIMAL(10,2)) as minStock, unit
            FROM Ingredient
            WHERE stock <= minStock AND minStock > 0
            ORDER BY (stock / NULLIF(minStock, 0)) ASC
        `;
        return ingredients.map(ing => ({
            id: Date.now() + ing.id,
            ingredientId: ing.id,
            ingredientName: ing.name,
            currentStock: ing.stock,
            minStock: ing.minStock,
            unit: ing.unit,
            severity: ing.stock <= 0 ? 'critical' : 'warning',
            timestamp: new Date()
        }));
    }
    /**
     * Broadcast current low stock status to all connected admin clients
     */
    async broadcastLowStockStatus() {
        try {
            const alerts = await this.getLowStockItems();
            const io = (0, socket_1.getIO)();
            io.to('admin:stock').emit('stock:status', alerts);
        }
        catch (error) {
            logger_1.logger.error('Failed to broadcast low stock status', { error });
        }
    }
}
exports.stockAlertService = new StockAlertService();
//# sourceMappingURL=stockAlert.service.js.map