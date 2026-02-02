/**
 * @fileoverview Adapter Factory
 *
 * Factory to get the correct adapter for each delivery platform.
 * Implements the Factory Method pattern to abstract adapter creation.
 *
 * @module integrations/delivery/adapters/AdapterFactory
 */

import { prisma } from '../../../lib/prisma';
import { Prisma } from '@prisma/client';
import type { DeliveryPlatform } from '@prisma/client';
import { AbstractDeliveryAdapter, type AdapterConfig } from './AbstractDeliveryAdapter';
import { RappiAdapter } from './RappiAdapter';
import { PedidosYaAdapter } from './PedidosYaAdapter';
import { DeliveryPlatformCode } from '../types/normalized.types';
import { NotFoundError, ValidationError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

/**
 * Platform code to adapter class mapping.
 * To add a new platform:
 * 1. Create the adapter (e.g., GlovoAdapter.ts)
 * 2. Add it to this registry
 */
const ADAPTER_REGISTRY: Record<
  string,
  new (platform: DeliveryPlatform, config?: Partial<AdapterConfig>) => AbstractDeliveryAdapter
> = {
  [DeliveryPlatformCode.RAPPI]: RappiAdapter,
  [DeliveryPlatformCode.PEDIDOSYA]: PedidosYaAdapter,
  // [DeliveryPlatformCode.GLOVO]: GlovoAdapter,       // TODO
  // [DeliveryPlatformCode.UBEREATS]: UberEatsAdapter, // TODO
};

// ============================================================================
// ADAPTER CACHE
// ============================================================================

/**
 * Instantiated adapter cache with TTL (PERF-009).
 * Avoids creating multiple instances of the same adapter.
 * TTL ensures credential changes are reflected without restart.
 */
const ADAPTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const adapterCache = new Map<number, { adapter: AbstractDeliveryAdapter; expiry: number }>();

// ============================================================================
// FACTORY
// ============================================================================

class AdapterFactoryClass {
  /**
   * Get an adapter by platform database ID.
   *
   * @param platformId - Platform ID in the database
   * @returns Corresponding adapter
   * @throws NotFoundError if the platform does not exist
   * @throws Error if no adapter is implemented for that platform
   */
  async getByPlatformId(platformId: number): Promise<AbstractDeliveryAdapter> {
    // Check cache first (with TTL check)
    const cached = adapterCache.get(platformId);
    if (cached && cached.expiry > Date.now()) {
      return cached.adapter;
    }
    if (cached) adapterCache.delete(platformId); // Expired

    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new NotFoundError(`Delivery platform with id=${platformId}`);
    }

    return this.createAdapter(platform);
  }

  /**
   * Get an adapter by platform code.
   *
   * @param code - Platform code (RAPPI, GLOVO, etc.)
   * @returns Corresponding adapter
   */
  async getByPlatformCode(code: string, tenantId?: number): Promise<AbstractDeliveryAdapter> {
    // FIX P0-SEC: code is now unique per tenant, not globally
    const where: Prisma.DeliveryPlatformWhereInput = { code: code.toUpperCase() };
    if (tenantId) where.tenantId = tenantId;
    const platform = await prisma.deliveryPlatform.findFirst({ where });

    if (!platform) {
      throw new NotFoundError(`Delivery platform with code=${code}`);
    }

    // Check cache (with TTL)
    const cachedEntry = adapterCache.get(platform.id);
    if (cachedEntry && cachedEntry.expiry > Date.now()) {
      return cachedEntry.adapter;
    }
    if (cachedEntry) adapterCache.delete(platform.id);

    return this.createAdapter(platform);
  }

  /**
   * Get all adapters for active platforms.
   *
   * @returns Array of active adapters
   */
  async getActiveAdapters(tenantId?: number): Promise<AbstractDeliveryAdapter[]> {
    const where: Prisma.DeliveryPlatformWhereInput = { isEnabled: true };
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
   * Check if an adapter exists for a platform.
   *
   * @param code - Platform code
   * @returns true if an adapter is implemented
   */
  hasAdapter(code: string): boolean {
    return code.toUpperCase() in ADAPTER_REGISTRY;
  }

  /**
   * List platform codes with available adapters.
   */
  getAvailablePlatformCodes(): string[] {
    return Object.keys(ADAPTER_REGISTRY);
  }

  /**
   * Invalidate the cache for a specific adapter.
   * Useful when platform credentials are updated.
   */
  invalidateCache(platformId: number): void {
    adapterCache.delete(platformId);
    logger.debug('Adapter cache invalidated', { platformId });
  }

  /**
   * Clear the entire adapter cache.
   */
  clearCache(): void {
    adapterCache.clear();
    logger.debug('Adapter cache cleared');
  }

  // ============================================================================
  // TENANT-SPECIFIC ADAPTERS
  // ============================================================================

  /**
   * Get an adapter configured specifically for a tenant.
   * This allows using tenant-specific credentials (storeId, apiKey, etc.)
   * instead of the platform's global ones.
   */
  async getAdapterForTenant(
    platformId: number,
    configOverrides: Partial<AdapterConfig>
  ): Promise<AbstractDeliveryAdapter> {
    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new NotFoundError(`Delivery platform with id=${platformId}`);
    }

    // No global cache here because configuration is tenant-specific
    return this.createAdapter(platform, configOverrides);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private createAdapter(
    platform: DeliveryPlatform,
    configOverrides: Partial<AdapterConfig> = {}
  ): AbstractDeliveryAdapter {
    const AdapterClass = ADAPTER_REGISTRY[platform.code.toUpperCase()];

    if (!AdapterClass) {
      throw new ValidationError(
        `No adapter implemented for platform: ${platform.code}. ` +
        `Available adapters: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`
      );
    }

    // Merge base configuration with tenant overrides
    // Overrides take priority (e.g., tenant storeId over platform storeId)
    const adapter = new AdapterClass(platform, configOverrides);
    
    // Only cache if NO overrides (global instance), with TTL
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

// Re-export classes for direct use if needed
export { RappiAdapter };
