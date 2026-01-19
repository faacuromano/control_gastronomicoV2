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
  new (platform: DeliveryPlatform) => AbstractDeliveryAdapter
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
 * Cache de adapters instanciados.
 * Evita crear múltiples instancias del mismo adapter.
 */
const adapterCache = new Map<number, AbstractDeliveryAdapter>();

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
    // Verificar cache primero
    const cached = adapterCache.get(platformId);
    if (cached) {
      return cached;
    }

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
  async getByPlatformCode(code: string): Promise<AbstractDeliveryAdapter> {
    const platform = await prisma.deliveryPlatform.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma de delivery con código=${code}`);
    }

    // Verificar cache
    const cached = adapterCache.get(platform.id);
    if (cached) {
      return cached;
    }

    return this.createAdapter(platform);
  }

  /**
   * Obtiene todos los adapters para plataformas activas.
   * 
   * @returns Array de adapters activos
   */
  async getActiveAdapters(): Promise<AbstractDeliveryAdapter[]> {
    const platforms = await prisma.deliveryPlatform.findMany({
      where: { isEnabled: true },
    });

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

  private createAdapter(platform: DeliveryPlatform): AbstractDeliveryAdapter {
    const AdapterClass = ADAPTER_REGISTRY[platform.code.toUpperCase()];

    if (!AdapterClass) {
      throw new Error(
        `No adapter implemented for platform: ${platform.code}. ` +
        `Available adapters: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`
      );
    }

    const adapter = new AdapterClass(platform);
    
    // Guardar en cache
    adapterCache.set(platform.id, adapter);
    
    logger.debug('Adapter created and cached', {
      platformId: platform.id,
      platformCode: platform.code,
      adapterName: adapter.getName(),
    });

    return adapter;
  }
}

// Singleton
export const AdapterFactory = new AdapterFactoryClass();

// Re-exportar clases para uso directo si es necesario
export { RappiAdapter };
