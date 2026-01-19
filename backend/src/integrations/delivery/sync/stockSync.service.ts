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

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { queueService, QUEUE_NAMES } from '../../../lib/queue';
import { logger } from '../../../utils/logger';
import type { AvailabilityUpdate } from '../types/normalized.types';

// ============================================================================
// TIPOS
// ============================================================================

interface StockSyncJobData {
  productId: number;
  productName: string;
  isAvailable: boolean;
  reason: 'OUT_OF_STOCK' | 'MANUAL' | 'INGREDIENT_SHORTAGE' | 'SCHEDULE';
  triggeredAt: string;
}

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
  async updateProductAvailability(
    productId: number,
    isAvailable: boolean
  ): Promise<Map<number, boolean>> {
    logger.info('Updating product availability', { productId, isAvailable });

    const results = new Map<number, boolean>();

    // Obtener todos los precios de canal para este producto
    const channelPrices = await prisma.productChannelPrice.findMany({
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
        await prisma.productChannelPrice.update({
          where: { id: channelPrice.id },
          data: { isAvailable },
        });

        // Notificar a la plataforma
        if (channelPrice.externalSku) {
          const adapter = await AdapterFactory.getByPlatformId(
            channelPrice.deliveryPlatformId
          );

          const update: AvailabilityUpdate = {
            externalSku: channelPrice.externalSku,
            productId,
            isAvailable,
          };

          await adapter.updateProductAvailability(update);
        }

        results.set(channelPrice.deliveryPlatformId, true);

        logger.debug('Product availability updated for platform', {
          productId,
          platformId: channelPrice.deliveryPlatformId,
          platformCode: channelPrice.deliveryPlatform.code,
          isAvailable,
        });

      } catch (error) {
        results.set(channelPrice.deliveryPlatformId, false);

        logger.error('Failed to update availability', {
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
  async markOutOfStock(
    productId: number,
    reason: 'OUT_OF_STOCK' | 'INGREDIENT_SHORTAGE' = 'OUT_OF_STOCK'
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    logger.info('Marking product as out of stock', {
      productId,
      productName: product.name,
      reason,
    });

    await this.updateProductAvailability(productId, false);
  }

  /**
   * Restaura la disponibilidad de un producto.
   */
  async markInStock(productId: number): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    logger.info('Restoring product availability', {
      productId,
      productName: product.name,
    });

    await this.updateProductAvailability(productId, true);
  }

  /**
   * Encola una actualización de stock para procesamiento asíncrono.
   * Útil para actualizaciones masivas.
   */
  async enqueueStockUpdate(
    productId: number,
    isAvailable: boolean,
    reason: 'OUT_OF_STOCK' | 'MANUAL' | 'INGREDIENT_SHORTAGE' | 'SCHEDULE' = 'MANUAL'
  ): Promise<string> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const jobData: StockSyncJobData = {
      productId,
      productName: product.name,
      isAvailable,
      reason,
      triggeredAt: new Date().toISOString(),
    };

    const jobId = await queueService.enqueue(
      QUEUE_NAMES.STOCK_SYNC,
      jobData,
      {
        jobId: `stock_sync_${productId}_${Date.now()}`,
      }
    );

    logger.info('Stock sync job enqueued', {
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
  async fullSyncToPlatform(platformId: number): Promise<number> {
    const channelPrices = await prisma.productChannelPrice.findMany({
      where: { deliveryPlatformId: platformId },
      include: { product: true },
    });

    let successCount = 0;

    for (const cp of channelPrices) {
      try {
        const isAvailable = cp.product.isActive && cp.isAvailable;
        
        if (cp.externalSku) {
          const adapter = await AdapterFactory.getByPlatformId(platformId);
          await adapter.updateProductAvailability({
            externalSku: cp.externalSku,
            productId: cp.productId,
            isAvailable,
          });
          successCount++;
        }
      } catch (error) {
        logger.error('Failed to sync product availability', {
          productId: cp.productId,
          platformId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Full stock sync completed', {
      platformId,
      successCount,
      totalProducts: channelPrices.length,
    });

    return successCount;
  }
}

export const stockSyncService = new StockSyncService();
