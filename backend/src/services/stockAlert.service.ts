/**
 * Stock Alert Service
 * Monitors stock levels and emits WebSocket alerts when below threshold
 */

import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';
import { logger } from '../utils/logger';

export interface StockAlert {
    id: number;
    ingredientId: number;
    ingredientName: string;
    currentStock: number;
    minStock: number;
    unit: string;
    severity: 'warning' | 'critical';
    timestamp: Date;
}

class StockAlertService {
    /**
     * Check if ingredient is below minimum stock and emit alert if so
     */
    async checkAndAlert(ingredientId: number, newStock: number): Promise<void> {
        try {
            const ingredient = await prisma.ingredient.findUnique({
                where: { id: ingredientId }
            });

            if (!ingredient) return;

            const minStock = Number(ingredient.minStock);
            const currentStock = Number(newStock);

            // Only alert if minStock is configured (> 0)
            if (minStock <= 0) return;

            if (currentStock <= minStock) {
                const alert: StockAlert = {
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
                logger.info('Stock alert emitted', { 
                    ingredient: ingredient.name, 
                    current: currentStock, 
                    min: minStock 
                });
            }
        } catch (error) {
            logger.error('Failed to check stock alert', { ingredientId, error });
        }
    }

    /**
     * Emit stock alert via WebSocket to admin:stock room
     */
    private emitAlert(alert: StockAlert): void {
        try {
            const io = getIO();
            io.to('admin:stock').emit('stock:low', alert);
        } catch (error) {
            logger.error('Failed to emit stock alert', { error });
        }
    }

    /**
     * Get all ingredients currently below minimum stock
     */
    async getLowStockItems(): Promise<StockAlert[]> {
        const ingredients = await prisma.$queryRaw<{
            id: number;
            name: string;
            stock: number;
            minStock: number;
            unit: string;
        }[]>`
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
            severity: ing.stock <= 0 ? 'critical' as const : 'warning' as const,
            timestamp: new Date()
        }));
    }

    /**
     * Broadcast current low stock status to all connected admin clients
     */
    async broadcastLowStockStatus(): Promise<void> {
        try {
            const alerts = await this.getLowStockItems();
            const io = getIO();
            io.to('admin:stock').emit('stock:status', alerts);
        } catch (error) {
            logger.error('Failed to broadcast low stock status', { error });
        }
    }
}

export const stockAlertService = new StockAlertService();
