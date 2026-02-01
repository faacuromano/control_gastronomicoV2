/**
 * @fileoverview Adapter Factory
 * 
 * Factory para obtener el adapter correcto según la plataforma.
 * Implementa el patrón Factory Method para abstraer la creación de adapters.
 * 
 * @module integrations/delivery/adapters/AdapterFactory
 */

import { prisma } from '../../../lib/prisma';
import type { DeliveryPlatform } from '@prisma/client';
import { AbstractDeliveryAdapter } from './AbstractDeliveryAdapter';
import { RappiAdapter } from './RappiAdapter';
import { PedidosYaAdapter } from './PedidosYaAdapter';
import { DeliveryPlatformCode } from '../types/normalized.types';
import { NotFoundError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';

// ============================================================================
// REGISTRY DE ADAPTERS
// ============================================================================

/**
 * Mapeo de códigos de plataforma a clases de adapter.
 * Para agregar una nueva plataforma:
 * 1. Crear el adapter (ej: GlovoAdapter.ts)
 * 2. Agregarlo a este registro
 */
const ADAPTER_REGISTRY: Record<
  string,
  new (platform: DeliveryPlatform, config?: any) => AbstractDeliveryAdapter
> = {
  [DeliveryPlatformCode.RAPPI]: RappiAdapter,
  [DeliveryPlatformCode.PEDIDOSYA]: PedidosYaAdapter,
  // [DeliveryPlatformCode.GLOVO]: GlovoAdapter,       // TODO
  // [DeliveryPlatformCode.UBEREATS]: UberEatsAdapter, // TODO
};

// ============================================================================
// CACHE DE ADAPTERS
// ============================================================================

/**
 * Cache de adapters instanciados with TTL (PERF-009).
 * Evita crear múltiples instancias del mismo adapter.
 * TTL ensures credential changes are reflected without restart.
 */
const ADAPTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const adapterCache = new Map<number, { adapter: AbstractDeliveryAdapter; expiry: number }>();

// ============================================================================
// FACTORY
// ============================================================================

class AdapterFactoryClass {
  /**
   * Obtiene un adapter por ID de plataforma.
   * 
   * @param platformId - ID de la plataforma en la base de datos
   * @returns Adapter correspondiente
   * @throws NotFoundError si la plataforma no existe
   * @throws Error si no hay adapter implementado para esa plataforma
   */
  async getByPlatformId(platformId: number): Promise<AbstractDeliveryAdapter> {
    // Verificar cache primero (with TTL check)
    const cached = adapterCache.get(platformId);
    if (cached && cached.expiry > Date.now()) {
      return cached.adapter;
    }
    if (cached) adapterCache.delete(platformId); // Expired

    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma de delivery con id=${platformId}`);
    }

    return this.createAdapter(platform);
  }

  /**
   * Obtiene un adapter por código de plataforma.
   * 
   * @param code - Código de la plataforma (RAPPI, GLOVO, etc.)
   * @returns Adapter correspondiente
   */
  async getByPlatformCode(code: string, tenantId?: number): Promise<AbstractDeliveryAdapter> {
    // FIX P0-SEC: code is now unique per tenant, not globally
    const where: any = { code: code.toUpperCase() };
    if (tenantId) where.tenantId = tenantId;
    const platform = await prisma.deliveryPlatform.findFirst({ where });

    if (!platform) {
      throw new NotFoundError(`Plataforma de delivery con código=${code}`);
    }

    // Verificar cache (with TTL)
    const cachedEntry = adapterCache.get(platform.id);
    if (cachedEntry && cachedEntry.expiry > Date.now()) {
      return cachedEntry.adapter;
    }
    if (cachedEntry) adapterCache.delete(platform.id);

    return this.createAdapter(platform);
  }

  /**
   * Obtiene todos los adapters para plataformas activas.
   * 
   * @returns Array de adapters activos
   */
  async getActiveAdapters(tenantId?: number): Promise<AbstractDeliveryAdapter[]> {
    const where: any = { isEnabled: true };
    if (tenantId) where.tenantId = tenantId;
    const platforms = await prisma.deliveryPlatform.findMany({ where });

    const adapters: AbstractDeliveryAdapter[] = [];

    for (const platform of platforms) {
      try {
        const adapter = this.createAdapter(platform);
        adapters.push(adapter);
      } catch (error) {
        logger.warn('Skipping platform - no adapter available', {
          platformCode: platform.code,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return adapters;
  }

  /**
   * Verifica si existe un adapter para una plataforma.
   * 
   * @param code - Código de la plataforma
   * @returns true si hay adapter implementado
   */
  hasAdapter(code: string): boolean {
    return code.toUpperCase() in ADAPTER_REGISTRY;
  }

  /**
   * Lista los códigos de plataformas con adaptadores disponibles.
   */
  getAvailablePlatformCodes(): string[] {
    return Object.keys(ADAPTER_REGISTRY);
  }

  /**
   * Invalida el cache de un adapter específico.
   * Útil cuando se actualizan las credenciales de una plataforma.
   */
  invalidateCache(platformId: number): void {
    adapterCache.delete(platformId);
    logger.debug('Adapter cache invalidated', { platformId });
  }

  /**
   * Limpia todo el cache de adapters.
   */
  clearCache(): void {
    adapterCache.clear();
    logger.debug('Adapter cache cleared');
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  /**
   * Obtiene un adapter configurado específicamente para un tenant.
   * Esto permite usar credenciales específicas del tenant (storeId, apiKey, etc.)
   * en lugar de las globales de la plataforma.
   */
  async getAdapterForTenant(
    platformId: number, 
    configOverrides: Partial<any>
  ): Promise<AbstractDeliveryAdapter> {
    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma de delivery con id=${platformId}`);
    }

    // No usamos cache global aquí porque la configuración es específica del tenant
    return this.createAdapter(platform, configOverrides);
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private createAdapter(
    platform: DeliveryPlatform, 
    configOverrides: Partial<any> = {}
  ): AbstractDeliveryAdapter {
    const AdapterClass = ADAPTER_REGISTRY[platform.code.toUpperCase()];

    if (!AdapterClass) {
      throw new Error(
        `No adapter implemented for platform: ${platform.code}. ` +
        `Available adapters: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`
      );
    }

    // Fusionar configuración base con overrides del tenant
    // Los overrides tienen prioridad (ej: storeId del tenant sobre storeId de plataforma)
    const adapter = new AdapterClass(platform, configOverrides);
    
    // Solo guardar en cache si NO hay overrides (instancia global), with TTL
    if (Object.keys(configOverrides).length === 0) {
      adapterCache.set(platform.id, { adapter, expiry: Date.now() + ADAPTER_CACHE_TTL_MS });
    }
    
    logger.debug('Adapter created', {
      platformId: platform.id,
      platformCode: platform.code,
      adapterName: adapter.getName(),
      hasOverrides: Object.keys(configOverrides).length > 0
    });

    return adapter;
  }
}

// Singleton
export const AdapterFactory = new AdapterFactoryClass();

// Re-exportar clases para uso directo si es necesario
export { RappiAdapter };
