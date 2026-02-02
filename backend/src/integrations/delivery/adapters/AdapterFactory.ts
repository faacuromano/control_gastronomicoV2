/**
 * @fileoverview Fabrica de Adaptadores de Delivery
 *
 * Fabrica centralizada que instancia y retorna el adaptador correcto para cada
 * plataforma de delivery. Implementa el patron Factory Method para abstraer
 * la creacion de adaptadores y desacoplar el codigo consumidor de las
 * implementaciones concretas.
 *
 * Tambien incluye un sistema de cache con TTL para reutilizar instancias
 * de adaptadores y evitar recrearlos en cada request.
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
// REGISTRO DE ADAPTADORES DISPONIBLES
// ============================================================================

/**
 * Mapeo de codigo de plataforma a su clase adaptadora concreta.
 * Para agregar soporte de una nueva plataforma:
 * 1. Crear el adaptador (ej: GlovoAdapter.ts) que extienda AbstractDeliveryAdapter
 * 2. Agregar la entrada correspondiente en este registro
 */
const ADAPTER_REGISTRY: Record<
  string,
  new (platform: DeliveryPlatform, config?: Partial<AdapterConfig>) => AbstractDeliveryAdapter
> = {
  [DeliveryPlatformCode.RAPPI]: RappiAdapter,
  [DeliveryPlatformCode.PEDIDOSYA]: PedidosYaAdapter,
  // [DeliveryPlatformCode.GLOVO]: GlovoAdapter,       // TODO: Pendiente de implementacion
  // [DeliveryPlatformCode.UBEREATS]: UberEatsAdapter, // TODO: Pendiente de implementacion
};

// ============================================================================
// CACHE DE ADAPTADORES CON TTL
// ============================================================================

/**
 * Cache de adaptadores ya instanciados con tiempo de vida (TTL) (PERF-009).
 * Evita crear multiples instancias del mismo adaptador por plataforma.
 * El TTL garantiza que cambios en credenciales se reflejen sin reiniciar
 * el servidor — al expirar, se recrea el adaptador con datos frescos de la BD.
 */
const ADAPTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de vida en cache
const adapterCache = new Map<number, { adapter: AbstractDeliveryAdapter; expiry: number }>();

// ============================================================================
// CLASE FACTORY
// ============================================================================

class AdapterFactoryClass {
  /**
   * Obtiene un adaptador buscando la plataforma por su ID en la base de datos.
   * Si existe en cache y no expiro, retorna la instancia cacheada.
   *
   * @param platformId - ID de la plataforma en la tabla DeliveryPlatform
   * @returns Adaptador correspondiente listo para usar
   * @throws NotFoundError si la plataforma no existe en la BD
   * @throws ValidationError si no hay adaptador implementado para esa plataforma
   */
  async getByPlatformId(platformId: number): Promise<AbstractDeliveryAdapter> {
    // Verificar cache primero (con control de TTL)
    const cached = adapterCache.get(platformId);
    if (cached && cached.expiry > Date.now()) {
      return cached.adapter;
    }
    if (cached) adapterCache.delete(platformId); // Entrada expirada, eliminar

    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new NotFoundError(`Delivery platform with id=${platformId}`);
    }

    return this.createAdapter(platform);
  }

  /**
   * Obtiene un adaptador buscando la plataforma por su codigo (RAPPI, PEDIDOSYA, etc.).
   * Opcionalmente filtra por tenantId para soportar multi-tenancy.
   *
   * @param code - Codigo de la plataforma
   * @param tenantId - ID del tenant (opcional, para filtrado multi-tenant)
   * @returns Adaptador correspondiente
   */
  async getByPlatformCode(code: string, tenantId?: number): Promise<AbstractDeliveryAdapter> {
    // FIX P0-SEC: El codigo ahora se busca con scope de tenant, no globalmente
    const where: Prisma.DeliveryPlatformWhereInput = { code: code.toUpperCase() };
    if (tenantId) where.tenantId = tenantId;
    const platform = await prisma.deliveryPlatform.findFirst({ where });

    if (!platform) {
      throw new NotFoundError(`Delivery platform with code=${code}`);
    }

    // Verificar cache (con TTL)
    const cachedEntry = adapterCache.get(platform.id);
    if (cachedEntry && cachedEntry.expiry > Date.now()) {
      return cachedEntry.adapter;
    }
    if (cachedEntry) adapterCache.delete(platform.id);

    return this.createAdapter(platform);
  }

  /**
   * Obtiene todos los adaptadores para plataformas habilitadas.
   * Util para operaciones masivas como sincronizacion de menu a todas las plataformas.
   *
   * @param tenantId - ID del tenant (opcional, para filtrado multi-tenant)
   * @returns Array de adaptadores activos y configurados
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
        // Si un adaptador falla al crearse, se salta pero se registra el warning
        logger.warn('Skipping platform - no adapter available', {
          platformCode: platform.code,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return adapters;
  }

  /**
   * Verifica si existe un adaptador implementado para un codigo de plataforma dado.
   *
   * @param code - Codigo de la plataforma
   * @returns true si hay un adaptador registrado para esa plataforma
   */
  hasAdapter(code: string): boolean {
    return code.toUpperCase() in ADAPTER_REGISTRY;
  }

  /**
   * Retorna la lista de codigos de plataforma que tienen adaptador implementado.
   */
  getAvailablePlatformCodes(): string[] {
    return Object.keys(ADAPTER_REGISTRY);
  }

  /**
   * Invalida la entrada de cache para un adaptador especifico.
   * Util cuando se actualizan las credenciales de una plataforma
   * y se necesita forzar la recreacion del adaptador.
   */
  invalidateCache(platformId: number): void {
    adapterCache.delete(platformId);
    logger.debug('Adapter cache invalidated', { platformId });
  }

  /**
   * Limpia completamente el cache de adaptadores.
   */
  clearCache(): void {
    adapterCache.clear();
    logger.debug('Adapter cache cleared');
  }

  // ============================================================================
  // ADAPTADORES ESPECIFICOS POR TENANT
  // ============================================================================

  /**
   * Obtiene un adaptador configurado especificamente para un tenant.
   * Permite usar credenciales propias del tenant (storeId, apiKey, etc.)
   * en lugar de las credenciales globales de la plataforma.
   * Este metodo NO cachea porque la configuracion es unica por tenant.
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

    // No se usa cache global porque la configuracion es especifica del tenant
    return this.createAdapter(platform, configOverrides);
  }

  // ============================================================================
  // METODOS PRIVADOS
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

    // Mezclar configuracion base de la plataforma con overrides del tenant.
    // Los overrides tienen prioridad (ej: storeId del tenant sobre storeId global)
    const adapter = new AdapterClass(platform, configOverrides);

    // Solo cachear si NO hay overrides (instancia global), con TTL
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

// Singleton — Una unica instancia de la factory para toda la aplicacion
export const AdapterFactory = new AdapterFactoryClass();

// Re-exportar clases concretas por si se necesitan instanciar directamente
export { RappiAdapter };
