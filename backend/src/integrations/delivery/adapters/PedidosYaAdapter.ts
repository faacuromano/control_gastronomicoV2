/**
 * @fileoverview PedidosYa Adapter Implementation
 * 
 * Implementación concreta del adapter para la plataforma PedidosYa.
 * 
 * DOCUMENTACIÓN PEDIDOSYA:
 * - API: Partner API (https://developers.pedidosya.com)
 * - Auth: OAuth 2.0 Client Credentials Flow
 * - Webhooks: HMAC-SHA256 en header X-PeYa-Signature
 * - Eventos: ORDER_DISPATCH (nuevo pedido), ORDER_STATUS_UPDATE
 * 
 * @module integrations/delivery/adapters/PedidosYaAdapter
 */

import axios, { type AxiosInstance } from 'axios';
import { AbstractDeliveryAdapter, type AdapterConfig } from './AbstractDeliveryAdapter';
import type { DeliveryPlatform } from '@prisma/client';
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
// TIPOS ESPECÍFICOS DE PEDIDOSYA (Raw Payloads)
// ============================================================================

/**
 * Payload raw de nuevo pedido de PedidosYa.
 * Estructura basada en documentación de PedidosYa Partner API.
 */
interface PedidosYaOrderPayload {
  id: string;
  code: string;  // Número visible para el cliente
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
      integrationCode?: string;  // SKU externo
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
    pending: number;  // Amount pending (0 if prepaid)
    paymentMethod: string;
    online: boolean;  // If true, paid online (prepaid)
  };
  
  restaurant: {
    id: string;
    name: string;
  };
  
  application: {
    name: 'PEDIDOSYA' | 'GLOVO' | 'RAPPI';
    version: string;
  };
  
  deliveryMethod?: 'PEYA' | 'MERCHANT';  // Who delivers
  expresDelivery?: boolean;
  
  notes?: string;
}

/**
 * Estructura del webhook de PedidosYa
 */
interface PedidosYaWebhookPayload {
  event: 'ORDER_DISPATCH' | 'ORDER_STATUS_UPDATE' | 'ORDER_CANCEL';
  order: PedidosYaOrderPayload;
  timestamp: string;
}

/**
 * Mapeo de estados de PedidosYa → Estados normalizados
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
 * Mapeo inverso: Estados normalizados → Estados de PedidosYa
 */
const NORMALIZED_TO_PEDIDOSYA_STATUS: Record<NormalizedOrderStatus, string> = {
  [NormalizedOrderStatus.NEW]: 'PENDING',
  [NormalizedOrderStatus.ACCEPTED]: 'CONFIRMED',
  [NormalizedOrderStatus.IN_PREPARATION]: 'IN_PROGRESS',
  [NormalizedOrderStatus.READY]: 'READY',
  [NormalizedOrderStatus.PICKED_UP]: 'PICKED_UP',
  [NormalizedOrderStatus.ON_ROUTE]: 'PICKED_UP',  // PeYa doesn't have ON_ROUTE
  [NormalizedOrderStatus.DELIVERED]: 'DELIVERED',
  [NormalizedOrderStatus.CANCELLED]: 'CANCELLED',
  [NormalizedOrderStatus.REJECTED]: 'REJECTED',
};

// ============================================================================
// PEDIDOSYA ADAPTER
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

    // Interceptor para agregar token y refrescarlo si es necesario
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
  // IMPLEMENTACIÓN DE MÉTODOS ABSTRACTOS
  // ============================================================================

  protected get platformCode(): DeliveryPlatformCode {
    return DeliveryPlatformCode.PEDIDOSYA;
  }

  protected getDefaultBaseUrl(): string {
    // Argentina endpoint
    return process.env.PEDIDOSYA_API_URL || 'https://api.pedidosya.com/v3';
  }

  /**
   * Valida la firma HMAC del webhook de PedidosYa.
   * PedidosYa usa HMAC-SHA256 con el body raw.
   * Header: X-PeYa-Signature
   */
  validateWebhookSignature(signature: string, rawBody: Buffer): boolean {
    if (!this.config.webhookSecret) {
      this.log('error', 'Cannot validate signature: webhookSecret not configured');
      return false;
    }

    // PedidosYa envía la firma como "sha256=xxxx"
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
   */
  parseWebhookPayload(rawPayload: unknown): ProcessedWebhook {
    const webhookData = rawPayload as PedidosYaWebhookPayload;
    const payload = webhookData.order || (rawPayload as PedidosYaOrderPayload);
    
    // Determinar tipo de evento
    const eventType = this.determineEventType(webhookData);
    
    // Convertir a formato normalizado
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
   * Acepta un pedido en PedidosYa.
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
   * Rechaza un pedido en PedidosYa.
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
   * Marca el pedido como listo para recoger.
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
   * Actualiza el estado del pedido en PedidosYa.
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
      // PedidosYa usa diferentes endpoints según el estado
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
   * Envía el menú a PedidosYa.
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

    // PedidosYa espera el menú en un formato específico (categories -> sections -> products)
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
      
      // Marcar todos como fallidos
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
   * Actualiza disponibilidad de un producto en PedidosYa.
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
  // OAUTH TOKEN MANAGEMENT
  // ============================================================================

  /**
   * Asegura que tenemos un token válido para la API.
   */
  private async ensureValidToken(): Promise<void> {
    // Si el token es válido y no ha expirado, no hacer nada
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    // Obtener nuevo token
    await this.refreshAccessToken();
  }

  /**
   * Obtiene un nuevo access token usando client credentials.
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.storeId,  // Client ID = Store ID en PedidosYa
          client_secret: this.config.apiKey,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      this.accessToken = response.data.access_token;
      // Expira en 1 hora menos 5 minutos de margen
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
  // MÉTODOS PRIVADOS DE NORMALIZACIÓN
  // ============================================================================

  private determineEventType(webhookData: Partial<PedidosYaWebhookPayload>): WebhookEventType {
    const event = webhookData.event?.toUpperCase();
    
    if (event === 'ORDER_DISPATCH') return WebhookEventType.ORDER_NEW;
    if (event === 'ORDER_CANCEL') return WebhookEventType.ORDER_CANCELLED;
    if (event === 'ORDER_STATUS_UPDATE') return WebhookEventType.STATUS_UPDATE;
    
    // Fallback: determinar por estado del pedido
    const order = webhookData.order;
    if (order?.state?.toUpperCase() === 'PENDING') return WebhookEventType.ORDER_NEW;
    if (order?.state?.toUpperCase() === 'CANCELLED') return WebhookEventType.ORDER_CANCELLED;
    
    return WebhookEventType.STATUS_UPDATE;
  }

  private normalizeOrder(payload: PedidosYaOrderPayload): NormalizedOrder {
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
    // SKU: usar integrationCode si existe, sino usar ID del producto
    const externalSku = detail.product.integrationCode || detail.product.id;
    
    // Aplanar los modificadores de los optionGroups
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
      removedIngredients: [], // PedidosYa manda esto en notes normalmente
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
