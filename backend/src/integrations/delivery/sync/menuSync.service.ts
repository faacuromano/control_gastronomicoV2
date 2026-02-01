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

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { queueService, QUEUE_NAMES } from '../../../lib/queue';
import { logger } from '../../../utils/logger';
import type { MenuSyncResult } from '../types/normalized.types';

// ============================================================================
// TIPOS
// ============================================================================

interface MenuSyncJobData {
  platformId: number;
  platformCode: string;
  triggeredBy: 'MANUAL' | 'SCHEDULE' | 'PRODUCT_UPDATE';
  triggeredAt: string;
}

interface ProductForSync {
  productId: number;
  externalSku: string;
  name: string;
  description: string;
  price: number;
  categoryName: string;
  isAvailable: boolean;
  imageUrl?: string | undefined;
}

// ============================================================================
// SERVICIO
// ============================================================================

class MenuSyncService {
  /**
   * Sincroniza el menú del tenant con una plataforma específica.
   * 
   * @param tenantId - ID del tenant
   * @param platformId - ID de la plataforma
   * @returns Resultado de la sincronización
   */
  async syncTenant(tenantId: number, platformId: number): Promise<MenuSyncResult> {
    const startTime = Date.now();
    logger.info('Starting menu sync', { tenantId, platformId });

    try {
      // 1. Obtener configuración del tenant para esta plataforma
      const config = await prisma.tenantPlatformConfig.findUnique({
        where: {
          tenantId_deliveryPlatformId: {
            tenantId,
            deliveryPlatformId: platformId
          }
        },
        include: {
            deliveryPlatform: true
        }
      });

      if (!config) {
        throw new Error(`Configuração não encontrada para tenant ${tenantId} plataforma ${platformId}`);
      }
      
      const platform = config.deliveryPlatform;

      // Verificar si sync está habilitado en nivel config
      if (!config.menuSyncEnabled) {
        logger.warn('Menu sync disabled for tenant platform', {
          tenantId,
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

      // 2. Obtener productos del tenant con precios de canal
      const products = await this.getProductsForTenantPlatform(tenantId, platformId);

      if (products.length === 0) {
        logger.warn('No products configured for tenant platform', { tenantId, platformId });
        return {
          success: true,
          syncedProducts: 0,
          failedProducts: 0,
          errors: [],
          syncedAt: new Date(),
        };
      }

      // 3. Obtener adapter con credenciales del tenant (overrides)
      const adapter = await AdapterFactory.getAdapterForTenant(platformId, {
        apiKey: config.apiKey,
        webhookSecret: config.webhookSecret,
        storeId: config.storeId
      });
      
      const result = await adapter.pushMenu(products);

      // 4. Actualizar timestamp de sync en config del tenant
      await prisma.tenantPlatformConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date() },
      });

      const duration = Date.now() - startTime;

      logger.info('Menu sync completed', {
        tenantId,
        platformId,
        platformCode: platform.code,
        syncedProducts: result.syncedProducts,
        failedProducts: result.failedProducts,
        durationMs: duration,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Menu sync failed', {
        tenantId,
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
   * Sincroniza el menú para todos los tenants y plataformas activas.
   * Útil para cron jobs globales.
   */
  async syncAllActiveTenants(): Promise<void> {
    // Buscar todas las configs activas con sync habilitado
    const configs = await prisma.tenantPlatformConfig.findMany({
      where: { 
        isActive: true,
        menuSyncEnabled: true,
      },
    });

    logger.info(`Starting batch sync for ${configs.length} tenant configs`);

    for (const config of configs) {
      try {
        await this.syncTenant(config.tenantId, config.deliveryPlatformId);
      } catch (e) {
        logger.error('Error in batch sync', { 
            tenantId: config.tenantId, 
            platformId: config.deliveryPlatformId,
            error: e 
        });
      }
    }
  }

  /**
   * Encola una sincronización de menú para procesamiento asíncrono.
   * Requiere tenantId ahora.
   */
  async enqueueSync(
    tenantId: number,
    platformId: number,
    triggeredBy: 'MANUAL' | 'SCHEDULE' | 'PRODUCT_UPDATE' = 'MANUAL'
  ): Promise<string> {
    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new Error(`Platform ${platformId} not found`);
    }

    const jobData: any = { // TODO: Update MenuSyncJobData type
      tenantId,
      platformId,
      platformCode: platform.code,
      triggeredBy,
      triggeredAt: new Date().toISOString(),
    };

    const jobId = await queueService.enqueue(
      QUEUE_NAMES.MENU_SYNC,
      jobData,
      {
        jobId: `menu_sync_${tenantId}_${platformId}_${Date.now()}`,
      }
    );

    logger.info('Menu sync job enqueued', {
      tenantId,
      platformId,
      platformCode: platform.code,
      jobId,
      triggeredBy,
    });

    return jobId;
  }

  /**
   * Obtiene los productos formateados para una plataforma y tenant.
   */
  private async getProductsForTenantPlatform(tenantId: number, platformId: number): Promise<ProductForSync[]> {
    const channelPrices = await prisma.productChannelPrice.findMany({
      where: {
        deliveryPlatformId: platformId,
        isAvailable: true,
        // Filtro crítico de multi-tenancy
        product: {
            tenantId: tenantId,
            isActive: true
        }
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

export const menuSyncService = new MenuSyncService();
