/**
 * @fileoverview Servicio de Sincronizacion de Stock con Plataformas de Delivery
 *
 * Servicio encargado de sincronizar la disponibilidad de productos con todas
 * las plataformas de delivery configuradas. Cuando un producto se agota o
 * vuelve a estar disponible, este servicio notifica a cada plataforma para
 * que el catalogo en linea refleje el estado real del inventario.
 *
 * CASOS DE USO:
 * - Un ingrediente se agota: markOutOfStock() deshabilita el producto en todas las plataformas
 * - Se recibe mercaderia: markInStock() restaura la disponibilidad
 * - Reconexion con plataforma: fullSyncToPlatform() sincroniza todo el catalogo
 * - Actualizaciones masivas: enqueueStockUpdate() encola para procesamiento asincrono
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
// TIPOS INTERNOS
// ============================================================================

interface StockSyncJobData {
  productId: number;
  productName: string;
  isAvailable: boolean;
  reason: 'OUT_OF_STOCK' | 'MANUAL' | 'INGREDIENT_SHORTAGE' | 'SCHEDULE';
  triggeredAt: string;
}

// ============================================================================
// SERVICIO DE SINCRONIZACION DE STOCK
// ============================================================================

class StockSyncService {
  /**
   * Actualiza la disponibilidad de un producto en todas las plataformas
   * donde esta configurado. Recorre cada precio de canal asociado al producto,
   * actualiza el estado en la BD local y notifica a la plataforma via el adaptador.
   *
   * @param productId - ID del producto a actualizar
   * @param isAvailable - Nuevo estado de disponibilidad
   * @returns Map con platformId como clave y resultado (true/false) como valor
   */
  async updateProductAvailability(
    productId: number,
    isAvailable: boolean
  ): Promise<Map<number, boolean>> {
    logger.info('Updating product availability', { productId, isAvailable });

    const results = new Map<number, boolean>();

    // Obtener todos los precios de canal configurados para este producto
    const channelPrices = await prisma.productChannelPrice.findMany({
      where: { productId },
      include: {
        deliveryPlatform: true,
      },
    });

    for (const channelPrice of channelPrices) {
      // Saltar plataformas deshabilitadas
      if (!channelPrice.deliveryPlatform.isEnabled) {
        continue;
      }

      try {
        // Actualizar disponibilidad en la BD local
        await prisma.productChannelPrice.update({
          where: { id: channelPrice.id },
          data: { isAvailable },
        });

        // Notificar a la plataforma solo si hay SKU externo configurado
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
   * Marca un producto como agotado en todas las plataformas.
   * Util cuando se detecta escasez de ingredientes o se agota el stock.
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
   * Restaura la disponibilidad de un producto en todas las plataformas.
   * Se usa cuando el producto vuelve a estar en stock.
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
   * Encola una actualizacion de stock para procesamiento asincrono via BullMQ.
   * Util para actualizaciones masivas donde no se quiere bloquear la respuesta HTTP.
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
   * Sincroniza la disponibilidad de todos los productos con una plataforma.
   * Util despues de reconectarse con una plataforma o para reconciliar estado.
   * Recorre todos los precios de canal y envia el estado actual a la plataforma.
   */
  async fullSyncToPlatform(platformId: number): Promise<number> {
    const channelPrices = await prisma.productChannelPrice.findMany({
      where: { deliveryPlatformId: platformId },
      include: { product: true },
    });

    let successCount = 0;

    for (const cp of channelPrices) {
      try {
        // La disponibilidad real depende de que el producto este activo Y habilitado en la plataforma
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
