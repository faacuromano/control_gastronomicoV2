"use strict";
/**
 * @fileoverview Menu Sync Service
 *
 * Servicio para sincronizar el menú del restaurante con plataformas de delivery.
 *
 * RESPONSABILIDADES:
 * 1. Obtener productos con precios de canal configurados
 * 2. Formatear menú según cada plataforma
 * 3. Enviar menú via adapter correspondiente
 * 4. Registrar resultado de sincronización
 *
 * @module integrations/delivery/sync/menuSync.service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuSyncService = void 0;
const prisma_1 = require("../../../lib/prisma");
const AdapterFactory_1 = require("../adapters/AdapterFactory");
const queue_1 = require("../../../lib/queue");
const logger_1 = require("../../../utils/logger");
// ============================================================================
// SERVICIO
// ============================================================================
class MenuSyncService {
    /**
     * Sincroniza el menú con una plataforma específica.
     *
     * @param platformId - ID de la plataforma
     * @returns Resultado de la sincronización
     */
    async syncToPlatform(platformId) {
        const startTime = Date.now();
        logger_1.logger.info('Starting menu sync', { platformId });
        try {
            // 1. Obtener plataforma
            const platform = await prisma_1.prisma.deliveryPlatform.findUnique({
                where: { id: platformId },
            });
            if (!platform) {
                throw new Error(`Platform ${platformId} not found`);
            }
            if (!platform.menuSyncEnabled) {
                logger_1.logger.warn('Menu sync disabled for platform', {
                    platformId,
                    platformCode: platform.code,
                });
                return {
                    success: false,
                    syncedProducts: 0,
                    failedProducts: 0,
                    errors: [{ productId: 0, error: 'Menu sync disabled for this platform' }],
                    syncedAt: new Date(),
                };
            }
            // 2. Obtener productos con precios de canal
            const products = await this.getProductsForPlatform(platformId);
            if (products.length === 0) {
                logger_1.logger.warn('No products configured for platform', { platformId });
                return {
                    success: true,
                    syncedProducts: 0,
                    failedProducts: 0,
                    errors: [],
                    syncedAt: new Date(),
                };
            }
            // 3. Obtener adapter y enviar
            const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformId(platformId);
            const result = await adapter.pushMenu(products);
            // 4. Actualizar timestamp de sync
            await prisma_1.prisma.deliveryPlatform.update({
                where: { id: platformId },
                data: { lastSyncAt: new Date() },
            });
            const duration = Date.now() - startTime;
            logger_1.logger.info('Menu sync completed', {
                platformId,
                platformCode: platform.code,
                syncedProducts: result.syncedProducts,
                failedProducts: result.failedProducts,
                durationMs: duration,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.logger.error('Menu sync failed', {
                platformId,
                durationMs: duration,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                syncedProducts: 0,
                failedProducts: 0,
                errors: [{
                        productId: 0,
                        error: error instanceof Error ? error.message : String(error)
                    }],
                syncedAt: new Date(),
            };
        }
    }
    /**
     * Sincroniza el menú con todas las plataformas activas.
     */
    async syncToAllPlatforms() {
        const platforms = await prisma_1.prisma.deliveryPlatform.findMany({
            where: {
                isEnabled: true,
                menuSyncEnabled: true,
            },
        });
        const results = new Map();
        for (const platform of platforms) {
            const result = await this.syncToPlatform(platform.id);
            results.set(platform.id, result);
        }
        return results;
    }
    /**
     * Encola una sincronización de menú para procesamiento asíncrono.
     */
    async enqueueSync(platformId, triggeredBy = 'MANUAL') {
        const platform = await prisma_1.prisma.deliveryPlatform.findUnique({
            where: { id: platformId },
        });
        if (!platform) {
            throw new Error(`Platform ${platformId} not found`);
        }
        const jobData = {
            platformId,
            platformCode: platform.code,
            triggeredBy,
            triggeredAt: new Date().toISOString(),
        };
        const jobId = await queue_1.queueService.enqueue(queue_1.QUEUE_NAMES.MENU_SYNC, jobData, {
            jobId: `menu_sync_${platformId}_${Date.now()}`,
        });
        logger_1.logger.info('Menu sync job enqueued', {
            platformId,
            platformCode: platform.code,
            jobId,
            triggeredBy,
        });
        return jobId;
    }
    /**
     * Obtiene los productos formateados para una plataforma.
     */
    async getProductsForPlatform(platformId) {
        const channelPrices = await prisma_1.prisma.productChannelPrice.findMany({
            where: {
                deliveryPlatformId: platformId,
                isAvailable: true,
            },
            include: {
                product: {
                    include: {
                        category: true,
                    },
                },
            },
        });
        return channelPrices
            .filter((cp) => cp.product.isActive)
            .map((cp) => ({
            productId: cp.product.id,
            externalSku: cp.externalSku || `SKU_${cp.product.id}`,
            name: cp.product.name,
            description: cp.product.description || '',
            price: Number(cp.price),
            categoryName: cp.product.category.name,
            isAvailable: cp.isAvailable,
            imageUrl: cp.product.image || undefined,
        }));
    }
}
exports.menuSyncService = new MenuSyncService();
//# sourceMappingURL=menuSync.service.js.map