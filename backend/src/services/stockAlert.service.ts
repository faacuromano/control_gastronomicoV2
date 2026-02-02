/**
 * @fileoverview Servicio de alertas de stock bajo.
 * Monitorea los niveles de inventario y emite alertas via WebSocket
 * cuando un ingrediente cae por debajo de su umbral minimo configurado.
 *
 * Las alertas se emiten al room de Socket.IO `tenant:{id}:admin:stock`
 * para que los administradores vean las notificaciones en tiempo real.
 *
 * @module services/stockAlert.service
 */

import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';
import { logger } from '../utils/logger';

/**
 * Estructura de una alerta de stock bajo.
 * Incluye severidad: 'warning' si esta por debajo del minimo, 'critical' si llego a 0.
 */
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
    // PERF-004: Throttle de alertas por ingrediente para evitar inundar el WebSocket.
    // Sin throttle, cada movimiento de stock en una venta podria generar una alerta.
    private alertThrottle = new Map<string, number>(); // clave -> timestamp del ultimo envio
    private static THROTTLE_MS = 5000; // Maximo 1 alerta por ingrediente cada 5 segundos

    /**
     * Verifica si un ingrediente esta por debajo del stock minimo y emite alerta si corresponde.
     * Se llama automaticamente despues de cada movimiento de stock.
     *
     * PERF-004: Implementa throttle por ingrediente para evitar alertas excesivas
     * durante operaciones masivas (ej: una venta con 10 items).
     */
    async checkAndAlert(ingredientId: number, tenantId: number, newStock: number): Promise<void> {
        try {
            const ingredient = await prisma.ingredient.findFirst({
                where: { id: ingredientId, tenantId }
            });

            if (!ingredient || !ingredient.tenantId) return;

            const minStock = Number(ingredient.minStock);
            const currentStock = Number(newStock);

            // Solo alertar si el stock minimo esta configurado (mayor a 0)
            if (minStock <= 0) return;

            if (currentStock <= minStock) {
                // PERF-004: Verificar throttle por ingrediente antes de emitir
                const throttleKey = `${tenantId}:${ingredientId}`;
                const lastEmit = this.alertThrottle.get(throttleKey) || 0;
                const now = Date.now();
                if (now - lastEmit < StockAlertService.THROTTLE_MS) {
                    return; // Omitir: ya se emitio una alerta reciente para este ingrediente
                }
                this.alertThrottle.set(throttleKey, now);

                // Limpiar entradas viejas del mapa de throttle para prevenir memory leak
                if (this.alertThrottle.size > 1000) {
                    const cutoff = now - StockAlertService.THROTTLE_MS * 2;
                    for (const [key, ts] of this.alertThrottle) {
                        if (ts < cutoff) this.alertThrottle.delete(key);
                    }
                }

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

                this.emitAlert(ingredient.tenantId, alert);
                logger.info('Stock alert emitted', {
                    tenantId: ingredient.tenantId,
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
     * Emite una alerta de stock via WebSocket al room de administradores de stock.
     * El room sigue el formato `tenant:{id}:admin:stock` para aislamiento multi-tenant.
     */
    private emitAlert(tenantId: number, alert: StockAlert): void {
        try {
            const io = getIO();
            if (!io) return;
            io.to(`tenant:${tenantId}:admin:stock`).emit('stock:low', alert);
        } catch (error) {
            logger.error('Failed to emit stock alert', { error });
        }
    }

    /**
     * Obtiene todos los ingredientes actualmente por debajo del stock minimo.
     * Usa una consulta raw SQL para eficiencia, ordenando por ratio stock/minStock
     * (los mas criticos primero).
     */
    async getLowStockItems(tenantId: number): Promise<StockAlert[]> {
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
            WHERE stock <= minStock AND minStock > 0 AND tenantId = ${tenantId}
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
     * Transmite el estado actual de stock bajo a todos los clientes admin conectados.
     * Se usa para sincronizar el panel de alertas cuando un admin se conecta.
     */
    async broadcastLowStockStatus(tenantId: number): Promise<void> {
        try {
            const alerts = await this.getLowStockItems(tenantId);
            const io = getIO();
            if (!io) return;
            io.to(`tenant:${tenantId}:admin:stock`).emit('stock:status', alerts);
        } catch (error) {
            logger.error('Failed to broadcast low stock status', { error });
        }
    }
}

export const stockAlertService = new StockAlertService();
