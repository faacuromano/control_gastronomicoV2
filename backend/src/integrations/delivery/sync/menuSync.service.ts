/**
 * @fileoverview Servicio de Sincronizacion de Menu con Plataformas de Delivery
 *
 * Servicio encargado de sincronizar el menu del restaurante con las plataformas
 * de delivery externas (Rappi, PedidosYa, etc.).
 *
 * RESPONSABILIDADES:
 * 1. Obtener productos del tenant con sus precios de canal configurados
 * 2. Verificar que la plataforma pertenezca al tenant (seguridad multi-tenant)
 * 3. Formatear el menu segun los requisitos de cada plataforma via el adaptador
 * 4. Enviar el menu completo usando el adaptador correspondiente
 * 5. Registrar el resultado y actualizar el timestamp de sincronizacion
 *
 * MODOS DE EJECUCION:
 * - Sincronizacion directa: syncTenant() ejecuta de forma sincrona
 * - Sincronizacion asincrona: enqueueSync() encola un job en BullMQ
 * - Sincronizacion masiva: syncAllActiveTenants() para cron jobs
 *
 * @module integrations/delivery/sync/menuSync.service
 */

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { queueService, QUEUE_NAMES } from '../../../lib/queue';
import { logger } from '../../../utils/logger';
import { NotFoundError } from '../../../utils/errors';
import type { MenuSyncResult } from '../types/normalized.types';

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface MenuSyncJobData {
  tenantId: number;
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
// SERVICIO DE SINCRONIZACION DE MENU
// ============================================================================

class MenuSyncService {
  /**
   * Sincroniza el menu completo de un tenant con una plataforma especifica.
   * Verifica permisos, obtiene productos, los envia a la plataforma y
   * actualiza el timestamp de ultima sincronizacion.
   *
   * @param tenantId - ID del tenant propietario del menu
   * @param platformId - ID de la plataforma destino
   * @returns Resultado de la sincronizacion con conteo de exitos y fallos
   */
  async syncTenant(tenantId: number, platformId: number): Promise<MenuSyncResult> {
    const startTime = Date.now();
    logger.info('Starting menu sync', { tenantId, platformId });

    try {
      // SEC-015: Verificar que la plataforma pertenezca al tenant (defensa en profundidad)
      const platformOwnership = await prisma.deliveryPlatform.findFirst({
        where: { id: platformId, tenantId },
      });
      if (!platformOwnership) {
        throw new NotFoundError(`Platform ${platformId} not found or does not belong to tenant ${tenantId}`);
      }

      // Paso 1: Obtener configuracion del tenant para esta plataforma
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
        throw new NotFoundError(`Configuration not found for tenant ${tenantId} platform ${platformId}`);
      }

      const platform = config.deliveryPlatform;

      // Verificar si la sincronizacion de menu esta habilitada en la configuracion del tenant
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

      // Paso 2: Obtener productos del tenant con precios de canal configurados
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

      // Paso 3: Obtener adaptador con credenciales del tenant (overrides)
      const adapter = await AdapterFactory.getAdapterForTenant(platformId, {
        ...(config.apiKey && { apiKey: config.apiKey }),
        ...(config.webhookSecret && { webhookSecret: config.webhookSecret }),
        ...(config.storeId && { storeId: config.storeId }),
      });

      const result = await adapter.pushMenu(products);

      // Paso 4: Actualizar timestamp de sincronizacion en la configuracion del tenant
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
   * Sincroniza el menu para todos los tenants y plataformas activas.
   * Util para cron jobs globales que mantienen los menus actualizados
   * de forma periodica sin intervencion manual.
   */
  async syncAllActiveTenants(): Promise<void> {
    // Buscar todas las configuraciones activas con sincronizacion de menu habilitada
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
   * Encola una sincronizacion de menu para procesamiento asincrono via BullMQ.
   * Util cuando se necesita sincronizar sin bloquear la respuesta HTTP.
   * Requiere tenantId para garantizar aislamiento multi-tenant.
   */
  async enqueueSync(
    tenantId: number,
    platformId: number,
    triggeredBy: 'MANUAL' | 'SCHEDULE' | 'PRODUCT_UPDATE' = 'MANUAL'
  ): Promise<string> {
    // FIX P0-SEC: Buscar plataforma con scope de tenantId
    const platform = await prisma.deliveryPlatform.findFirst({
      where: { id: platformId, tenantId },
    });

    if (!platform) {
      throw new NotFoundError(`Platform ${platformId} not found for tenant ${tenantId}`);
    }

    const jobData: MenuSyncJobData = {
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
   * Obtiene los productos formateados para enviar a una plataforma especifica.
   * Solo incluye productos activos del tenant que tienen precios de canal configurados
   * y disponibilidad habilitada para esa plataforma.
   */
  private async getProductsForTenantPlatform(tenantId: number, platformId: number): Promise<ProductForSync[]> {
    const channelPrices = await prisma.productChannelPrice.findMany({
      where: {
        deliveryPlatformId: platformId,
        isAvailable: true,
        // Filtro critico de multi-tenancy: solo productos del tenant
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
