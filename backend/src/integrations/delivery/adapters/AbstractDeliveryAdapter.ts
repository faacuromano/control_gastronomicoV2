/**
 * @fileoverview Abstract Delivery Adapter
 * 
 * Clase base abstracta que define el contrato para todas las integraciones
 * de plataformas de delivery (Rappi, Glovo, PedidosYa, UberEats).
 * 
 * PATRONES UTILIZADOS:
 * - Template Method: Define el flujo, subclases implementan detalles
 * - Adapter Pattern: Normaliza APIs externas dispares a interfaz común
 * 
 * RESPONSABILIDADES:
 * 1. Validar webhooks entrantes (HMAC)
 * 2. Parsear payloads a formato normalizado
 * 3. Enviar actualizaciones de estado a plataforma
 * 4. Sincronizar menú y disponibilidad
 * 
 * @module integrations/delivery/adapters/AbstractDeliveryAdapter
 */

import type { DeliveryPlatform } from '@prisma/client';
import type {
  DeliveryPlatformCode,
  NormalizedOrder,
  NormalizedOrderStatus,
  MenuSyncResult,
  AvailabilityUpdate,
  StatusUpdateResult,
  WebhookEventType,
  ProcessedWebhook,
} from '../types/normalized.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// TIPOS DE CONFIGURACIÓN
// ============================================================================

/**
 * Configuración común para todos los adapters.
 */
export interface AdapterConfig {
  /** ID de la plataforma en DB */
  platformId: number;
  /** Código de la plataforma */
  platformCode: DeliveryPlatformCode;
  /** API Key para autenticación saliente */
  apiKey: string;
  /** Secreto para validar webhooks entrantes */
  webhookSecret: string;
  /** ID del local en la plataforma */
  storeId: string;
  /** URL base de la API de la plataforma */
  baseUrl: string;
  /** Timeout para requests (ms) */
  timeout: number;
}

/**
 * Contexto de request para logging/tracing.
 */
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// CLASE ABSTRACTA
// ============================================================================

/**
 * Adapter abstracto para plataformas de delivery.
 * 
 * Subclases deben implementar:
 * - validateWebhookSignature()
 * - parseWebhookPayload()
 * - acceptOrder()
 * - rejectOrder()
 * - updateOrderStatus()
 * - pushMenu()
 * - updateProductAvailability()
 * 
 * @example
 * ```typescript
 * class RappiAdapter extends AbstractDeliveryAdapter {
 *   protected get platformCode() { return DeliveryPlatformCode.RAPPI; }
 *   // ... implementar métodos abstractos
 * }
 * ```
 */
export abstract class AbstractDeliveryAdapter {
  protected config: AdapterConfig;
  protected platform: DeliveryPlatform;

  constructor(platform: DeliveryPlatform, config: Partial<AdapterConfig> = {}) {
    this.platform = platform;
    this.config = {
      platformId: platform.id,
      platformCode: platform.code as DeliveryPlatformCode,
      apiKey: platform.apiKey || '',
      webhookSecret: platform.webhookSecret || '',
      storeId: platform.storeId || '',
      baseUrl: this.getDefaultBaseUrl(),
      timeout: 30000,
      ...config,
    };

    this.validateConfig();
  }

  // ============================================================================
  // MÉTODOS ABSTRACTOS (Implementar en subclases)
  // ============================================================================

  /**
   * Código de plataforma para logging.
   */
  protected abstract get platformCode(): DeliveryPlatformCode;

  /**
   * URL base de la API de la plataforma.
   */
  protected abstract getDefaultBaseUrl(): string;

  /**
   * Valida la firma HMAC del webhook.
   * 
   * CRÍTICO PARA SEGURIDAD:
   * Cada plataforma tiene su propio método de firma.
   * - Rappi: HMAC-SHA256 en header X-Rappi-Signature
   * - Glovo: HMAC-SHA512 en header X-Glovo-Signature
   * - PedidosYa: HMAC-SHA256 en header X-PY-Signature
   * 
   * @param signature - Firma recibida en el header
   * @param rawBody - Body raw del request (Buffer, no parseado)
   * @returns true si la firma es válida
   */
  abstract validateWebhookSignature(signature: string, rawBody: Buffer): boolean;

  /**
   * Parsea el payload del webhook al formato normalizado.
   * 
   * @param rawPayload - Payload JSON del webhook
   * @returns Webhook procesado con orden normalizada
   */
  abstract parseWebhookPayload(rawPayload: unknown): ProcessedWebhook;

  /**
   * Acepta un pedido en la plataforma.
   * Debe llamarse dentro de los primeros ~4 minutos.
   * 
   * @param externalOrderId - ID del pedido en la plataforma
   * @param estimatedPrepTime - Tiempo estimado de preparación (minutos)
   */
  abstract acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void>;

  /**
   * Rechaza un pedido en la plataforma.
   * 
   * @param externalOrderId - ID del pedido en la plataforma
   * @param reason - Razón del rechazo
   */
  abstract rejectOrder(externalOrderId: string, reason: string): Promise<void>;

  /**
   * Actualiza el estado del pedido en la plataforma.
   * 
   * @param externalOrderId - ID del pedido en la plataforma
   * @param status - Nuevo estado normalizado
   */
  abstract updateOrderStatus(
    externalOrderId: string, 
    status: NormalizedOrderStatus
  ): Promise<StatusUpdateResult>;

  /**
   * Envía el menú completo a la plataforma.
   * 
   * @param products - Lista de productos con sus precios de canal
   */
  abstract pushMenu(products: Array<{
    productId: number;
    externalSku: string;
    name: string;
    description: string;
    price: number;
    categoryName: string;
    isAvailable: boolean;
    imageUrl?: string | undefined;
  }>): Promise<MenuSyncResult>;

  /**
   * Actualiza la disponibilidad de un producto.
   * 
   * @param update - Información de disponibilidad
   */
  abstract updateProductAvailability(update: AvailabilityUpdate): Promise<void>;

  // ============================================================================
  // MÉTODOS COMUNES (Heredados por subclases)
  // ============================================================================

  /**
   * Valida la configuración del adapter.
   * @throws Error si falta configuración crítica
   */
  protected validateConfig(): void {
    if (!this.config.webhookSecret) {
      logger.warn('Adapter initialized without webhook secret', {
        platform: this.platformCode,
        platformId: this.config.platformId,
      });
    }

    if (!this.config.apiKey) {
      logger.warn('Adapter initialized without API key', {
        platform: this.platformCode,
        platformId: this.config.platformId,
      });
    }
  }

  /**
   * Obtiene el nombre para logging.
   */
  public getName(): string {
    return `${this.platformCode}Adapter`;
  }

  /**
   * Obtiene el ID de la plataforma.
   */
  public getPlatformId(): number {
    return this.config.platformId;
  }

  /**
   * Verifica si el adapter está completamente configurado.
   */
  public isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.webhookSecret &&
      this.config.storeId
    );
  }

  /**
   * Log helper con contexto de plataforma.
   */
  protected log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta: Record<string, unknown> = {}
  ): void {
    logger[level](message, {
      platform: this.platformCode,
      platformId: this.config.platformId,
      ...meta,
    });
  }

  /**
   * Helper para calcular HMAC.
   * Las subclases pueden usar esto para sus implementaciones específicas.
   */
  protected computeHmac(
    body: Buffer,
    secret: string,
    algorithm: 'sha256' | 'sha512' = 'sha256'
  ): string {
    const crypto = require('crypto');
    return crypto
      .createHmac(algorithm, secret)
      .update(body)
      .digest('hex');
  }

  /**
   * Compara de forma segura dos strings (timing-safe).
   * CRÍTICO para evitar timing attacks en validación HMAC.
   */
  protected timingSafeEqual(a: string, b: string): boolean {
    const crypto = require('crypto');
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    
    if (bufA.length !== bufB.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
