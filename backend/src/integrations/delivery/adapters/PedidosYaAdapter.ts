/**
 * @fileoverview Implementacion del Adaptador de PedidosYa
 *
 * Adaptador concreto que implementa la integracion con la plataforma PedidosYa.
 * Convierte las APIs propietarias de PedidosYa al formato normalizado del sistema.
 *
 * DOCUMENTACION DE PEDIDOSYA:
 * - API: Partner API (https://developers.pedidosya.com)
 * - Autenticacion: OAuth 2.0 Client Credentials Flow
 * - Webhooks: HMAC-SHA256 firmado en el header X-PeYa-Signature
 * - Eventos: ORDER_DISPATCH (nuevo pedido), ORDER_STATUS_UPDATE (cambio de estado)
 *
 * PARTICULARIDADES DE PEDIDOSYA:
 * - Usa endpoints distintos por tipo de estado (ej: /ready vs /status generico)
 * - El token OAuth expira en 1 hora y se renueva automaticamente
 * - La firma del webhook viene con prefijo "sha256=" que hay que separar
 *
 * @module integrations/delivery/adapters/PedidosYaAdapter
 */

import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { AbstractDeliveryAdapter, type AdapterConfig } from './AbstractDeliveryAdapter';
import type { DeliveryPlatform } from '@prisma/client';
import { ValidationError } from '../../../utils/errors';
import {
  DeliveryPlatformCode,
  NormalizedOrder,
  NormalizedOrderStatus,
  NormalizedOrderItem,
  NormalizedCustomer,
  NormalizedAddress,
  ProcessedWebhook,
  WebhookEventType,
  MenuSyncResult,
  AvailabilityUpdate,
  StatusUpdateResult,
} from '../types/normalized.types';

// ============================================================================
// TIPOS ESPECIFICOS DE PEDIDOSYA (Payloads crudos de la API)
// ============================================================================

/**
 * Schemas Zod para validar el payload del webhook de PedidosYa.
 * Se definen para garantizar que los datos recibidos cumplen con la estructura
 * esperada antes de procesarlos, evitando errores en runtime.
 */
const PedidosYaCoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const PedidosYaAddressSchema = z.object({
  description: z.string(),
  area: z.string().optional(),
  city: z.string().optional(),
  coordinates: PedidosYaCoordinatesSchema.optional(),
  notes: z.string().optional(),
  doorNumber: z.string().optional(),
  zipCode: z.string().optional(),
});

const PedidosYaUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const PedidosYaOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  quantity: z.number(),
});

const PedidosYaOptionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  options: z.array(PedidosYaOptionSchema),
});

const PedidosYaProductSchema = z.object({
  id: z.string(),
  integrationCode: z.string().optional(),
  name: z.string(),
  unitPrice: z.number(),
});

const PedidosYaDetailSchema = z.object({
  product: PedidosYaProductSchema,
  quantity: z.number(),
  notes: z.string().optional(),
  optionGroups: z.array(PedidosYaOptionGroupSchema).optional(),
});

const PedidosYaPaymentSchema = z.object({
  total: z.number(),
  subtotal: z.number(),
  discount: z.number(),
  tip: z.number(),
  shipping: z.number(),
  pending: z.number(),
  paymentMethod: z.string(),
  online: z.boolean(),
});

const PedidosYaRestaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const PedidosYaApplicationSchema = z.object({
  name: z.enum(['PEDIDOSYA', 'GLOVO', 'RAPPI']),
  version: z.string(),
});

const PedidosYaOrderPayloadSchema = z.object({
  id: z.string(),
  code: z.string(),
  state: z.string(),
  registeredDate: z.string(),
  deliveryDate: z.string().optional(),
  pickup: z.boolean(),
  preOrder: z.boolean(),
  user: PedidosYaUserSchema,
  address: PedidosYaAddressSchema.optional(),
  details: z.array(PedidosYaDetailSchema),
  payment: PedidosYaPaymentSchema,
  restaurant: PedidosYaRestaurantSchema,
  application: PedidosYaApplicationSchema,
  deliveryMethod: z.enum(['PEYA', 'MERCHANT']).optional(),
  expresDelivery: z.boolean().optional(),
  notes: z.string().optional(),
});

const PedidosYaWebhookPayloadSchema = z.object({
  event: z.enum(['ORDER_DISPATCH', 'ORDER_STATUS_UPDATE', 'ORDER_CANCEL']).optional(),
  order: PedidosYaOrderPayloadSchema.optional(),
  timestamp: z.string().optional(),
});

/**
 * Payload crudo de un pedido nuevo de PedidosYa.
 * La estructura corresponde a la documentacion de la Partner API de PedidosYa.
 */
interface PedidosYaOrderPayload {
  id: string;
  code: string;  // Numero visible para el cliente
  state: string;
  registeredDate: string;
  deliveryDate?: string;
  pickup: boolean;
  preOrder: boolean;

  user: {
    id: string;
    name: string;
    lastName: string;
    phone?: string;
    email?: string;
  };

  address?: {
    description: string;
    area?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    notes?: string;
    doorNumber?: string;
    zipCode?: string;
  };

  details: Array<{
    product: {
      id: string;
      integrationCode?: string;  // SKU externo configurado por el restaurante
      name: string;
      unitPrice: number;
    };
    quantity: number;
    notes?: string;
    optionGroups?: Array<{
      id: string;
      name: string;
      options: Array<{
        id: string;
        name: string;
        amount: number;
        quantity: number;
      }>;
    }>;
  }>;

  payment: {
    total: number;
    subtotal: number;
    discount: number;
    tip: number;
    shipping: number;
    pending: number;  // Monto pendiente de cobro (0 si esta prepago)
    paymentMethod: string;
    online: boolean;  // true si fue pagado online (prepago)
  };

  restaurant: {
    id: string;
    name: string;
  };

  application: {
    name: 'PEDIDOSYA' | 'GLOVO' | 'RAPPI';
    version: string;
  };

  deliveryMethod?: 'PEYA' | 'MERCHANT';  // Quien realiza la entrega
  expresDelivery?: boolean;

  notes?: string;
}

/**
 * Estructura del webhook de PedidosYa que envuelve el pedido con el tipo de evento.
 */
interface PedidosYaWebhookPayload {
  event: 'ORDER_DISPATCH' | 'ORDER_STATUS_UPDATE' | 'ORDER_CANCEL';
  order: PedidosYaOrderPayload;
  timestamp: string;
}

/**
 * Mapeo de estados de PedidosYa a estados normalizados internos.
 * Permite traducir los estados propietarios de la plataforma al formato comun.
 */
const PEDIDOSYA_STATUS_MAP: Record<string, NormalizedOrderStatus> = {
  'PENDING': NormalizedOrderStatus.NEW,
  'CONFIRMED': NormalizedOrderStatus.ACCEPTED,
  'IN_PROGRESS': NormalizedOrderStatus.IN_PREPARATION,
  'READY': NormalizedOrderStatus.READY,
  'PICKED_UP': NormalizedOrderStatus.PICKED_UP,
  'DELIVERED': NormalizedOrderStatus.DELIVERED,
  'CANCELLED': NormalizedOrderStatus.CANCELLED,
  'REJECTED': NormalizedOrderStatus.REJECTED,
};

/**
 * Mapeo inverso: de estado normalizado a estado de PedidosYa.
 * Se usa para enviar actualizaciones de estado desde nuestro sistema a PedidosYa.
 */
const NORMALIZED_TO_PEDIDOSYA_STATUS: Record<NormalizedOrderStatus, string> = {
  [NormalizedOrderStatus.NEW]: 'PENDING',
  [NormalizedOrderStatus.ACCEPTED]: 'CONFIRMED',
  [NormalizedOrderStatus.IN_PREPARATION]: 'IN_PROGRESS',
  [NormalizedOrderStatus.READY]: 'READY',
  [NormalizedOrderStatus.PICKED_UP]: 'PICKED_UP',
  [NormalizedOrderStatus.ON_ROUTE]: 'PICKED_UP',  // PedidosYa no tiene estado ON_ROUTE separado
  [NormalizedOrderStatus.DELIVERED]: 'DELIVERED',
  [NormalizedOrderStatus.CANCELLED]: 'CANCELLED',
  [NormalizedOrderStatus.REJECTED]: 'REJECTED',
};

// ============================================================================
// ADAPTADOR DE PEDIDOSYA
// ============================================================================

export class PedidosYaAdapter extends AbstractDeliveryAdapter {
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(platform: DeliveryPlatform, config: Partial<AdapterConfig> = {}) {
    super(platform, config);

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor que agrega el token OAuth y lo renueva automaticamente si expiro.
    // Se ejecuta antes de cada request saliente hacia la API de PedidosYa.
    this.httpClient.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      config.headers.Authorization = `Bearer ${this.accessToken}`;

      this.log('debug', 'Outgoing request to PedidosYa', {
        method: config.method,
        url: config.url,
      });
      return config;
    });
  }

  // ============================================================================
  // IMPLEMENTACION DE METODOS ABSTRACTOS
  // ============================================================================

  protected get platformCode(): DeliveryPlatformCode {
    return DeliveryPlatformCode.PEDIDOSYA;
  }

  protected getDefaultBaseUrl(): string {
    // Endpoint de Argentina por defecto
    return process.env.PEDIDOSYA_API_URL || 'https://api.pedidosya.com/v3';
  }

  /**
   * Valida la firma HMAC del webhook de PedidosYa.
   * PedidosYa usa HMAC-SHA256 con el body crudo y envia la firma
   * en el header X-PeYa-Signature con formato "sha256=xxxx".
   */
  validateWebhookSignature(signature: string, rawBody: Buffer): boolean {
    if (!this.config.webhookSecret) {
      this.log('error', 'Cannot validate signature: webhookSecret not configured');
      return false;
    }

    // PedidosYa envia la firma con prefijo "sha256=" que hay que separar
    const signatureParts = signature.split('=');
    const actualSignature = signatureParts.length > 1 ? signatureParts[1] : signature;

    if (!actualSignature) {
      this.log('error', 'Invalid signature format');
      return false;
    }

    const expectedSignature = this.computeHmac(rawBody, this.config.webhookSecret, 'sha256');
    const isValid = this.timingSafeEqual(actualSignature, expectedSignature);

    if (!isValid) {
      this.log('warn', 'Webhook signature validation failed', {
        receivedLength: actualSignature.length,
        expectedLength: expectedSignature.length,
      });
    }

    return isValid;
  }

  /**
   * Parsea el payload del webhook de PedidosYa al formato normalizado.
   * Soporta dos formatos: el wrapper de webhook con evento, o el pedido directo.
   */
  parseWebhookPayload(rawPayload: unknown): ProcessedWebhook {
    // Validar con Zod — intentar primero como webhook envuelto, luego como pedido directo
    let webhookData: Partial<PedidosYaWebhookPayload>;
    let payload: PedidosYaOrderPayload;

    const webhookParsed = PedidosYaWebhookPayloadSchema.safeParse(rawPayload);
    if (webhookParsed.success && webhookParsed.data.order) {
      // Es un webhook envuelto con tipo de evento
      webhookData = webhookParsed.data as PedidosYaWebhookPayload;
      payload = webhookParsed.data.order as PedidosYaOrderPayload;
    } else {
      // Intentar parsear como pedido directo (sin wrapper de evento)
      const orderParsed = PedidosYaOrderPayloadSchema.safeParse(rawPayload);
      if (!orderParsed.success) {
        this.log('error', 'Invalid PedidosYa webhook payload', {
          webhookIssues: webhookParsed.error?.issues || [],
          orderIssues: orderParsed.error.issues,
        });
        throw new ValidationError(`Invalid PedidosYa webhook payload: ${orderParsed.error.message}`);
      }
      webhookData = {};
      payload = orderParsed.data as PedidosYaOrderPayload;
    }

    // Determinar el tipo de evento del webhook
    const eventType = this.determineEventType(webhookData);

    // Convertir al formato normalizado interno
    const order = this.normalizeOrder(payload);

    return {
      eventType,
      platform: DeliveryPlatformCode.PEDIDOSYA,
      externalOrderId: payload.id,
      order,
      receivedAt: new Date(),
      rawPayload,
    };
  }

  /**
   * Acepta un pedido en PedidosYa enviando confirmacion con tiempo de preparacion.
   */
  async acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void> {
    try {
      await this.httpClient.post(`/orders/${externalOrderId}/confirmation`, {
        state: 'CONFIRMED',
        cookingTime: estimatedPrepTime,
      });

      this.log('info', 'Order accepted in PedidosYa', { externalOrderId, estimatedPrepTime });
    } catch (error) {
      this.log('error', 'Failed to accept order in PedidosYa', {
        externalOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Rechaza un pedido en PedidosYa con el motivo indicado.
   */
  async rejectOrder(externalOrderId: string, reason: string): Promise<void> {
    try {
      await this.httpClient.post(`/orders/${externalOrderId}/rejection`, {
        state: 'REJECTED',
        rejectMessage: reason,
      });

      this.log('info', 'Order rejected in PedidosYa', { externalOrderId, reason });
    } catch (error) {
      this.log('error', 'Failed to reject order in PedidosYa', {
        externalOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Marca el pedido como listo para retiro en PedidosYa.
   * PedidosYa tiene un endpoint dedicado para este estado especifico.
   */
  async markReady(externalOrderId: string): Promise<void> {
    try {
      await this.httpClient.post(`/orders/${externalOrderId}/ready`, {
        state: 'READY',
      });

      this.log('info', 'Order marked ready in PedidosYa', { externalOrderId });
    } catch (error) {
      this.log('error', 'Failed to mark order ready in PedidosYa', {
        externalOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Actualiza el estado de un pedido en PedidosYa.
   * Nota: PedidosYa usa endpoints diferentes segun el estado (ej: /ready tiene
   * su propio endpoint), por eso se hace routing interno aqui.
   */
  async updateOrderStatus(
    externalOrderId: string,
    status: NormalizedOrderStatus
  ): Promise<StatusUpdateResult> {
    const peyaStatus = NORMALIZED_TO_PEDIDOSYA_STATUS[status];

    if (!peyaStatus) {
      return {
        success: false,
        externalId: externalOrderId,
        newStatus: status,
        error: `Unknown status mapping for: ${status}`,
      };
    }

    try {
      // PedidosYa usa endpoints distintos segun el tipo de estado
      if (status === NormalizedOrderStatus.READY) {
        await this.markReady(externalOrderId);
      } else {
        await this.httpClient.patch(`/orders/${externalOrderId}`, {
          state: peyaStatus,
        });
      }

      this.log('info', 'Order status updated in PedidosYa', { externalOrderId, status: peyaStatus });

      return {
        success: true,
        externalId: externalOrderId,
        newStatus: status,
      };
    } catch (error) {
      return {
        success: false,
        externalId: externalOrderId,
        newStatus: status,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Envia el menu completo a PedidosYa.
   * PedidosYa espera el menu agrupado en secciones por categoria.
   */
  async pushMenu(products: Array<{
    productId: number;
    externalSku: string;
    name: string;
    description: string;
    price: number;
    categoryName: string;
    isAvailable: boolean;
    imageUrl?: string;
  }>): Promise<MenuSyncResult> {
    const errors: Array<{ productId: number; error: string }> = [];
    let syncedProducts = 0;

    // PedidosYa espera el menu en formato especifico: categorias -> secciones -> productos
    const peyaMenu = {
      name: 'Menu',
      sections: this.groupProductsByCategory(products),
    };

    try {
      await this.httpClient.put(
        `/restaurants/${this.config.storeId}/menu`,
        peyaMenu
      );
      syncedProducts = products.length;

      this.log('info', 'Menu synced to PedidosYa', { productCount: syncedProducts });
    } catch (error) {
      this.log('error', 'Failed to sync menu to PedidosYa', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Si fallo el envio del menu completo, marcar todos los productos como fallidos
      products.forEach((p) => {
        errors.push({ productId: p.productId, error: 'Menu sync failed' });
      });
    }

    return {
      success: errors.length === 0,
      syncedProducts,
      failedProducts: errors.length,
      errors,
      syncedAt: new Date(),
    };
  }

  /**
   * Actualiza la disponibilidad de un producto individual en PedidosYa.
   */
  async updateProductAvailability(update: AvailabilityUpdate): Promise<void> {
    try {
      await this.httpClient.patch(
        `/restaurants/${this.config.storeId}/products/${update.externalSku}`,
        { enabled: update.isAvailable }
      );

      this.log('info', 'Product availability updated in PedidosYa', {
        externalSku: update.externalSku,
        isAvailable: update.isAvailable,
      });
    } catch (error) {
      this.log('error', 'Failed to update product availability in PedidosYa', {
        externalSku: update.externalSku,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // GESTION DE TOKENS OAUTH — Autenticacion saliente con PedidosYa
  // ============================================================================

  /**
   * Garantiza que haya un token OAuth valido disponible para hacer requests.
   * Si el token actual esta vigente, no hace nada. Si expiro, lo renueva.
   */
  private async ensureValidToken(): Promise<void> {
    // Si el token existe y aun no expiro, no hacer nada
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    // Obtener un nuevo token via Client Credentials Flow
    await this.refreshAccessToken();
  }

  /**
   * Obtiene un nuevo token de acceso usando el flujo OAuth Client Credentials.
   * El token se almacena en memoria con un margen de seguridad de 5 minutos
   * antes de la expiracion real para evitar usar tokens a punto de expirar.
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.storeId,  // En PedidosYa, el Client ID es el Store ID
          client_secret: this.config.apiKey,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      this.accessToken = response.data.access_token;
      // Expira en 1 hora menos 5 minutos de margen de seguridad
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      this.log('info', 'PedidosYa access token refreshed', {
        expiresIn: response.data.expires_in,
      });
    } catch (error) {
      this.log('error', 'Failed to refresh PedidosYa access token', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // METODOS PRIVADOS DE NORMALIZACION — Conversion de formatos PedidosYa a interno
  // ============================================================================

  private determineEventType(webhookData: Partial<PedidosYaWebhookPayload>): WebhookEventType {
    const event = webhookData.event?.toUpperCase();

    if (event === 'ORDER_DISPATCH') return WebhookEventType.ORDER_NEW;
    if (event === 'ORDER_CANCEL') return WebhookEventType.ORDER_CANCELLED;
    if (event === 'ORDER_STATUS_UPDATE') return WebhookEventType.STATUS_UPDATE;

    // Fallback: si no hay evento explicito, determinar por el estado del pedido
    const order = webhookData.order;
    if (order?.state?.toUpperCase() === 'PENDING') return WebhookEventType.ORDER_NEW;
    if (order?.state?.toUpperCase() === 'CANCELLED') return WebhookEventType.ORDER_CANCELLED;

    return WebhookEventType.STATUS_UPDATE;
  }

  private normalizeOrder(payload: PedidosYaOrderPayload): NormalizedOrder {
    // Determinar tipo de fulfillment segun si es pickup o delivery por plataforma/propio
    const fulfillmentType = payload.pickup
      ? 'TAKEAWAY' as const
      : (payload.deliveryMethod === 'MERCHANT' ? 'SELF_DELIVERY' as const : 'PLATFORM_DELIVERY' as const);

    return {
      externalId: payload.id,
      platform: DeliveryPlatformCode.PEDIDOSYA,
      displayNumber: payload.code,
      status: PEDIDOSYA_STATUS_MAP[payload.state?.toUpperCase()] || NormalizedOrderStatus.NEW,
      createdAt: new Date(payload.registeredDate),
      fulfillmentType,

      customer: this.normalizeCustomer(payload.user),
      deliveryAddress: payload.address && !payload.pickup
        ? this.normalizeAddress(payload.address)
        : undefined,

      items: payload.details.map((detail) => this.normalizeItem(detail)),

      subtotal: payload.payment.subtotal,
      deliveryFee: payload.payment.shipping,
      discount: payload.payment.discount,
      tip: payload.payment.tip,
      total: payload.payment.total,

      estimatedDeliveryAt: payload.deliveryDate
        ? new Date(payload.deliveryDate)
        : undefined,

      notes: payload.notes,
      paymentMethod: payload.payment.paymentMethod as 'ONLINE' | 'CASH' | 'CARD',
      isPrepaid: payload.payment.online || payload.payment.pending === 0,

      storeId: payload.restaurant.id,

      rawPayload: payload,
    };
  }

  private normalizeCustomer(user: PedidosYaOrderPayload['user']): NormalizedCustomer {
    return {
      externalId: user.id,
      name: `${user.name} ${user.lastName || ''}`.trim(),
      phone: user.phone,
      email: user.email,
    };
  }

  private normalizeAddress(
    address: NonNullable<PedidosYaOrderPayload['address']>
  ): NormalizedAddress {
    // Componer la direccion completa concatenando las partes disponibles
    const fullAddress = [
      address.description,
      address.doorNumber,
      address.area,
      address.city
    ].filter(Boolean).join(', ');

    return {
      fullAddress,
      street: address.description,
      city: address.city,
      zipCode: address.zipCode,
      latitude: address.coordinates?.latitude,
      longitude: address.coordinates?.longitude,
      instructions: address.notes,
    };
  }

  private normalizeItem(detail: PedidosYaOrderPayload['details'][0]): NormalizedOrderItem {
    // SKU: usar el integrationCode si esta configurado, sino usar el ID del producto en PedidosYa
    const externalSku = detail.product.integrationCode || detail.product.id;

    // Aplanar los modificadores desde los grupos de opciones de PedidosYa
    const modifiers = (detail.optionGroups || []).flatMap(group =>
      group.options.map(opt => ({
        externalSku: opt.id,
        name: opt.name,
        price: opt.amount,
        quantity: opt.quantity,
      }))
    );

    return {
      externalSku,
      name: detail.product.name,
      quantity: detail.quantity,
      unitPrice: detail.product.unitPrice,
      notes: detail.notes,
      modifiers,
      removedIngredients: [], // PedidosYa envia ingredientes removidos dentro de las notas
    };
  }

  private groupProductsByCategory(
    products: Array<{ categoryName: string; [key: string]: unknown }>
  ): Array<{ name: string; products: unknown[] }> {
    const categoryMap = new Map<string, unknown[]>();

    for (const product of products) {
      const existing = categoryMap.get(product.categoryName) || [];
      existing.push({
        integrationCode: product.externalSku,
        name: product.name,
        description: product.description,
        price: product.price,
        enabled: product.isAvailable,
        image: product.imageUrl,
      });
      categoryMap.set(product.categoryName, existing);
    }

    return Array.from(categoryMap.entries()).map(([name, prods]) => ({
      name,
      products: prods,
    }));
  }
}
