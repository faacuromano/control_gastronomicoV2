"use strict";
/**
 * @fileoverview Stock Sync Service
 *
 * Servicio para sincronizar disponibilidad de productos con plataformas de delivery.
 *
 * Cuando un producto se queda sin stock o se marca como no disponible,
 * este servicio notifica a todas las plataformas configuradas.
 *
 * @module integrations/delivery/sync/stockSync.service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockSyncService = void 0;
const prisma_1 = require("../../../lib/prisma");
const AdapterFactory_1 = require("../adapters/AdapterFactory");
const queue_1 = require("../../../lib/queue");
const logger_1 = require("../../../utils/logger");
// ============================================================================
// SERVICIO
// ============================================================================
class StockSyncService {
    /**
     * Actualiza la disponibilidad de un producto en todas las plataformas.
     *
     * @param productId - ID del producto
     * @param isAvailable - Nuevo estado de disponibilidad
     */
    async updateProductAvailability(productId, isAvailable) {
        logger_1.logger.info('Updating product availability', { productId, isAvailable });
        const results = new Map();
        // Obtener todos los precios de canal para este producto
        const channelPrices = await prisma_1.prisma.productChannelPrice.findMany({
            where: { productId },
            include: {
                deliveryPlatform: true,
            },
        });
        for (const channelPrice of channelPrices) {
            if (!channelPrice.deliveryPlatform.isEnabled) {
                continue;
            }
            try {
                // Actualizar en DB
                await prisma_1.prisma.productChannelPrice.update({
                    where: { id: channelPrice.id },
                    data: { isAvailable },
                });
                // Notificar a la plataforma
                if (channelPrice.externalSku) {
                    const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformId(channelPrice.deliveryPlatformId);
                    const update = {
                        externalSku: channelPrice.externalSku,
                        productId,
                        isAvailable,
                    };
                    await adapter.updateProductAvailability(update);
                }
                results.set(channelPrice.deliveryPlatformId, true);
                logger_1.logger.debug('Product availability updated for platform', {
                    productId,
                    platformId: channelPrice.deliveryPlatformId,
                    platformCode: channelPrice.deliveryPlatform.code,
                    isAvailable,
                });
            }
            catch (error) {
                results.set(channelPrice.deliveryPlatformId, false);
                logger_1.logger.error('Failed to update availability', {
                    productId,
                    platformId: channelPrice.deliveryPlatformId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return results;
    }
    /**
     * Marca un producto como fuera de stock en todas las plataformas.
     * Útil cuando se detecta falta de ingredientes.
     */
    async markOutOfStock(productId, reason = 'OUT_OF_STOCK') {
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }
        logger_1.logger.info('Marking product as out of stock', {
            productId,
            productName: product.name,
            reason,
        });
        await this.updateProductAvailability(productId, false);
    }
    /**
     * Restaura la disponibilidad de un producto.
     */
    async markInStock(productId) {
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }
        logger_1.logger.info('Restoring product availability', {
            productId,
            productName: product.name,
        });
        await this.updateProductAvailability(productId, true);
    }
    /**
     * Encola una actualización de stock para procesamiento asíncrono.
     * Útil para actualizaciones masivas.
     */
    async enqueueStockUpdate(productId, isAvailable, reason = 'MANUAL') {
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }
        const jobData = {
            productId,
            productName: product.name,
            isAvailable,
            reason,
            triggeredAt: new Date().toISOString(),
        };
        const jobId = await queue_1.queueService.enqueue(queue_1.QUEUE_NAMES.STOCK_SYNC, jobData, {
            jobId: `stock_sync_${productId}_${Date.now()}`,
        });
        logger_1.logger.info('Stock sync job enqueued', {
            productId,
            productName: product.name,
            isAvailable,
            jobId,
        });
        return jobId;
    }
    /**
     * Sincroniza disponibilidad de todos los productos con una plataforma.
     * Útil después de reconectar con una plataforma.
     */
    async fullSyncToPlatform(platformId) {
        const channelPrices = await prisma_1.prisma.productChannelPrice.findMany({
            where: { deliveryPlatformId: platformId },
            include: { product: true },
        });
        let successCount = 0;
        for (const cp of channelPrices) {
            try {
                const isAvailable = cp.product.isActive && cp.isAvailable;
                if (cp.externalSku) {
                    const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformId(platformId);
                    await adapter.updateProductAvailability({
                        externalSku: cp.externalSku,
                        productId: cp.productId,
                        isAvailable,
                    });
                    successCount++;
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to sync product availability', {
                    productId: cp.productId,
                    platformId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        logger_1.logger.info('Full stock sync completed', {
            platformId,
            successCount,
            totalProducts: channelPrices.length,
        });
        return successCount;
    }
}
exports.stockSyncService = new StockSyncService();
//# sourceMappingURL=stockSync.service.js.map