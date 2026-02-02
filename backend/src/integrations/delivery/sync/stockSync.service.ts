/**
 * @fileoverview Stock Sync Service
 *
 * Service to synchronize product availability with delivery platforms.
 *
 * When a product runs out of stock or is marked as unavailable,
 * this service notifies all configured platforms.
 *
 * @module integrations/delivery/sync/stockSync.service
 */

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { queueService, QUEUE_NAMES } from '../../../lib/queue';
import { logger } from '../../../utils/logger';
import { NotFoundError } from '../../../utils/errors';
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

    // Get all channel prices for this product
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
        // Update in DB
        await prisma.productChannelPrice.update({
          where: { id: channelPrice.id },
          data: { isAvailable },
        });

        // Notify the platform
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
   * Marks a product as out of stock on all platforms.
   * Useful when ingredient shortage is detected.
   */
  async markOutOfStock(
    productId: number,
    reason: 'OUT_OF_STOCK' | 'INGREDIENT_SHORTAGE' = 'OUT_OF_STOCK'
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product ${productId}`);
    }

    logger.info('Marking product as out of stock', {
      productId,
      productName: product.name,
      reason,
    });

    await this.updateProductAvailability(productId, false);
  }

  /**
   * Restores product availability.
   */
  async markInStock(productId: number): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product ${productId}`);
    }

    logger.info('Restoring product availability', {
      productId,
      productName: product.name,
    });

    await this.updateProductAvailability(productId, true);
  }

  /**
   * Enqueues a stock update for async processing.
   * Useful for bulk updates.
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
      throw new NotFoundError(`Product ${productId}`);
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
   * Syncs availability of all products with a platform.
   * Useful after reconnecting with a platform.
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
