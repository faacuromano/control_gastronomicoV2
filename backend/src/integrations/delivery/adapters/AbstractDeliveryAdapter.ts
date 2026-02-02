/**
 * @fileoverview Adaptador Abstracto de Delivery
 *
 * Clase base abstracta que define el contrato obligatorio para todas las integraciones
 * de plataformas de delivery (Rappi, Glovo, PedidosYa, UberEats).
 *
 * PATRONES DE DISENO UTILIZADOS:
 * - Template Method: La clase base define el flujo general y las subclases concretas
 *   implementan los detalles especificos de cada plataforma.
 * - Adapter Pattern: Normaliza las APIs externas dispares de cada plataforma
 *   a una interfaz comun interna, desacoplando el sistema del proveedor.
 *
 * RESPONSABILIDADES PRINCIPALES:
 * 1. Validar firmas HMAC de webhooks entrantes para garantizar autenticidad
 * 2. Parsear payloads crudos de cada plataforma al formato normalizado interno
 * 3. Enviar actualizaciones de estado de pedidos a la plataforma correspondiente
 * 4. Sincronizar menu y disponibilidad de productos con la plataforma
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
// TIPOS DE CONFIGURACION DEL ADAPTER
// ============================================================================

/**
 * Configuracion comun que comparten todos los adapters de delivery.
 * Cada campo representa un parametro necesario para comunicarse con la API
 * de la plataforma externa.
 */
export interface AdapterConfig {
  /** ID de la plataforma en nuestra base de datos (tabla DeliveryPlatform) */
  platformId: number;
  /** Codigo identificador de la plataforma (RAPPI, PEDIDOSYA, etc.) */
  platformCode: DeliveryPlatformCode;
  /** API Key para autenticacion en llamadas salientes hacia la plataforma */
  apiKey: string;
  /** Secreto compartido para validar firmas HMAC de webhooks entrantes */
  webhookSecret: string;
  /** ID del local/restaurante en la plataforma externa */
  storeId: string;
  /** URL base de la API REST de la plataforma */
  baseUrl: string;
  /** Timeout maximo para requests HTTP salientes (en milisegundos) */
  timeout: number;
}

/**
 * Contexto de la request entrante, utilizado para logging y trazabilidad
 * de operaciones a traves del sistema.
 */
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// CLASE ABSTRACTA BASE
// ============================================================================

/**
 * Adaptador abstracto para plataformas de delivery.
 *
 * Todas las subclases concretas (RappiAdapter, PedidosYaAdapter, etc.)
 * deben implementar los siguientes metodos abstractos:
 * - validateWebhookSignature() — Validacion HMAC especifica de la plataforma
 * - parseWebhookPayload() — Parseo del payload crudo al formato normalizado
 * - acceptOrder() — Aceptar un pedido en la plataforma
 * - rejectOrder() — Rechazar un pedido en la plataforma
 * - updateOrderStatus() — Actualizar estado de pedido en la plataforma
 * - pushMenu() — Enviar menu completo a la plataforma
 * - updateProductAvailability() — Actualizar disponibilidad de un producto
 *
 * @example
 * ```typescript
 * class RappiAdapter extends AbstractDeliveryAdapter {
 *   protected get platformCode() { return DeliveryPlatformCode.RAPPI; }
 *   // ... implementar metodos abstractos
 * }
 * ```
 */
export abstract class AbstractDeliveryAdapter {
  protected config: AdapterConfig;
  protected platform: DeliveryPlatform;

  constructor(platform: DeliveryPlatform, config: Partial<AdapterConfig> = {}) {
    this.platform = platform;
    // Se construye la configuracion mezclando valores por defecto del modelo
    // de base de datos con cualquier override proporcionado por el llamador
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
  // METODOS ABSTRACTOS — Deben ser implementados por cada subclase concreta
  // ============================================================================

  /**
   * Codigo unico de la plataforma, utilizado para logging y routing.
   */
  protected abstract get platformCode(): DeliveryPlatformCode;

  /**
   * Retorna la URL base por defecto de la API de la plataforma.
   * Cada plataforma tiene su propio endpoint (ej: api.pedidosya.com/v3).
   */
  protected abstract getDefaultBaseUrl(): string;

  /**
   * Valida la firma HMAC del webhook entrante.
   *
   * CRITICO PARA SEGURIDAD: Sin esta validacion, un atacante podria inyectar
   * pedidos falsos en el sistema. Cada plataforma utiliza su propio metodo:
   * - Rappi: HMAC-SHA256 en header X-Rappi-Signature
   * - Glovo: HMAC-SHA512 en header X-Glovo-Signature
   * - PedidosYa: HMAC-SHA256 en header X-PY-Signature
   *
   * @param signature - Firma recibida en el header HTTP de la plataforma
   * @param rawBody - Body crudo del request como Buffer (no parseado a JSON)
   * @returns true si la firma es valida y el webhook es autentico
   */
  abstract validateWebhookSignature(signature: string, rawBody: Buffer): boolean;

  /**
   * Parsea el payload crudo del webhook y lo convierte al formato normalizado
   * interno del sistema. Cada plataforma envia datos en estructuras diferentes,
   * y este metodo se encarga de unificarlas.
   *
   * @param rawPayload - Payload JSON sin procesar recibido del webhook
   * @returns Webhook procesado con la orden en formato normalizado
   */
  abstract parseWebhookPayload(rawPayload: unknown): ProcessedWebhook;

  /**
   * Acepta un pedido en la plataforma externa.
   * Las plataformas requieren aceptacion dentro de un tiempo limite
   * (tipicamente ~4 minutos), caso contrario el pedido se cancela automaticamente.
   *
   * @param externalOrderId - ID del pedido en la plataforma externa
   * @param estimatedPrepTime - Tiempo estimado de preparacion en minutos
   */
  abstract acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void>;

  /**
   * Rechaza un pedido en la plataforma externa.
   * Se usa cuando el restaurante no puede cumplir con el pedido.
   *
   * @param externalOrderId - ID del pedido en la plataforma externa
   * @param reason - Razon del rechazo (se envia a la plataforma)
   */
  abstract rejectOrder(externalOrderId: string, reason: string): Promise<void>;

  /**
   * Actualiza el estado de un pedido en la plataforma externa.
   * Permite que la plataforma y el cliente vean el progreso real.
   *
   * @param externalOrderId - ID del pedido en la plataforma externa
   * @param status - Nuevo estado en formato normalizado interno
   */
  abstract updateOrderStatus(
    externalOrderId: string,
    status: NormalizedOrderStatus
  ): Promise<StatusUpdateResult>;

  /**
   * Envia el menu completo del restaurante a la plataforma.
   * Se utiliza para sincronizar productos, precios y disponibilidad.
   *
   * @param products - Lista de productos con sus precios de canal y datos completos
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
   * Actualiza la disponibilidad de un producto individual en la plataforma.
   * Se invoca cuando un producto se agota o vuelve a estar disponible.
   *
   * @param update - Informacion de disponibilidad del producto
   */
  abstract updateProductAvailability(update: AvailabilityUpdate): Promise<void>;

  // ============================================================================
  // METODOS COMUNES — Heredados y reutilizados por todas las subclases
  // ============================================================================

  /**
   * Valida que la configuracion del adapter tenga los campos minimos necesarios.
   * Emite warnings si faltan campos criticos como el secreto HMAC o la API key,
   * pero no lanza error para permitir inicializacion parcial en desarrollo.
   *
   * @throws Error si falta configuracion absolutamente critica
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
   * Retorna el nombre descriptivo del adapter para uso en logs.
   */
  public getName(): string {
    return `${this.platformCode}Adapter`;
  }

  /**
   * Retorna el ID de la plataforma en la base de datos.
   */
  public getPlatformId(): number {
    return this.config.platformId;
  }

  /**
   * Verifica si el adapter tiene toda la configuracion necesaria para operar.
   * Requiere API key, secreto de webhook y ID de tienda configurados.
   */
  public isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.webhookSecret &&
      this.config.storeId
    );
  }

  /**
   * Helper de logging que agrega automaticamente el contexto de la plataforma
   * a cada mensaje de log, evitando repetir esos campos en cada llamada.
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
   * Helper para calcular firmas HMAC con el algoritmo especificado.
   * Las subclases utilizan este metodo como base para sus implementaciones
   * especificas de validacion de webhook.
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
   * Compara dos strings de forma segura en tiempo constante (timing-safe).
   * CRITICO para prevenir ataques de timing en la validacion HMAC, donde un
   * atacante podria deducir la firma correcta midiendo el tiempo de respuesta.
   */
  protected timingSafeEqual(a: string, b: string): boolean {
    const crypto = require('crypto');
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    // Si los buffers tienen distinta longitud, no son iguales
    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * SEC-027: Valida la firma del webhook contra el secreto actual y el anterior.
   * Soporta rotacion de secretos sin downtime: durante la transicion, ambos
   * secretos son validos simultaneamente.
   *
   * El campo webhookSecret soporta valores separados por coma:
   *   "secreto_actual,secreto_anterior"
   * Durante la rotacion, ambos son validos. Una vez confirmado que la plataforma
   * usa el nuevo secreto, se puede eliminar el anterior.
   *
   * @param signature - Firma recibida en el header del webhook
   * @param rawBody - Body crudo de la request
   * @param algorithm - Algoritmo HMAC a utilizar
   * @returns true si la firma coincide con alguno de los secretos configurados
   */
  protected validateWithRotation(
    signature: string,
    rawBody: Buffer,
    algorithm: 'sha256' | 'sha512' = 'sha256'
  ): boolean {
    // Separar secretos por coma, limpiar espacios y filtrar vacios
    const secrets = this.config.webhookSecret.split(',').map(s => s.trim()).filter(Boolean);

    for (const secret of secrets) {
      const computed = this.computeHmac(rawBody, secret, algorithm);
      if (this.timingSafeEqual(signature, computed)) {
        // Si matcheo con un secreto que no es el primario, hay una rotacion en curso
        if (secrets.indexOf(secret) > 0) {
          this.log('info', 'Webhook validated with previous secret — rotation in progress', {
            secretIndex: secrets.indexOf(secret),
          });
        }
        return true;
      }
    }

    return false;
  }
}
