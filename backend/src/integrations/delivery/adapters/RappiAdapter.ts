/**
 * @fileoverview Rappi Adapter Implementation
 * 
 * Implementación concreta del adapter para la plataforma Rappi.
 * 
 * DOCUMENTACIÓN RAPPI:
 * - Webhooks: Firma HMAC-SHA256 en header X-Rappi-Signature
 * - Timeout: 4 minutos para aceptar/rechazar
 * - API Base: https://services.rappi.com.ar/api/v1
 * 
 * @module integrations/delivery/adapters/RappiAdapter
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
// TIPOS ESPECÍFICOS DE RAPPI (Raw Payloads)
// ============================================================================

/**
 * Payload raw de nuevo pedido de Rappi.
 * Estructura basada en documentación de Rappi Partners API.
 */
interface RappiOrderPayload {
  order_id: string;
  order_number: string;
  status: string;
  created_at: string;
  estimated_delivery_time?: string;
  
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
  };
  
  delivery_address?: {
    address: string;
    address_two?: string;
    city: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
  };
  
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    comments?: string;
    toppings?: Array<{
      sku: string;
      name: string;
      price: number;
      quantity: number;
    }>;
  }>;
  
  totals: {
    subtotal: number;
    delivery_fee: number;
    discount: number;
    tip: number;
    total: number;
  };
  
  payment: {
    method: 'ONLINE' | 'CASH' | 'CARD';
    is_prepaid: boolean;
  };
  
  notes?: string;
}

/**
 * Mapeo de estados de Rappi → Estados normalizados
 */
const RAPPI_STATUS_MAP: Record<string, NormalizedOrderStatus> = {
  'NEW': NormalizedOrderStatus.NEW,
  'ACCEPTED': NormalizedOrderStatus.ACCEPTED,
  'IN_STORE': NormalizedOrderStatus.IN_PREPARATION,
  'READY_FOR_PICKUP': NormalizedOrderStatus.READY,
  'PICKED_UP': NormalizedOrderStatus.PICKED_UP,
  'ON_THE_WAY': NormalizedOrderStatus.ON_ROUTE,
  'DELIVERED': NormalizedOrderStatus.DELIVERED,
  'CANCELLED': NormalizedOrderStatus.CANCELLED,
  'REJECTED': NormalizedOrderStatus.REJECTED,
};

/**
 * Mapeo inverso: Estados normalizados → Estados de Rappi
 */
const NORMALIZED_TO_RAPPI_STATUS: Record<NormalizedOrderStatus, string> = {
  [NormalizedOrderStatus.NEW]: 'NEW',
  [NormalizedOrderStatus.ACCEPTED]: 'ACCEPTED',
  [NormalizedOrderStatus.IN_PREPARATION]: 'IN_STORE',
  [NormalizedOrderStatus.READY]: 'READY_FOR_PICKUP',
  [NormalizedOrderStatus.PICKED_UP]: 'PICKED_UP',
  [NormalizedOrderStatus.ON_ROUTE]: 'ON_THE_WAY',
  [NormalizedOrderStatus.DELIVERED]: 'DELIVERED',
  [NormalizedOrderStatus.CANCELLED]: 'CANCELLED',
  [NormalizedOrderStatus.REJECTED]: 'REJECTED',
};

// ============================================================================
// RAPPI ADAPTER
// ============================================================================

export class RappiAdapter extends AbstractDeliveryAdapter {
  private httpClient: AxiosInstance;

  constructor(platform: DeliveryPlatform, config: Partial<AdapterConfig> = {}) {
    super(platform, config);
    
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Store-Id': this.config.storeId,
      },
    });

    // Log de requests para debugging
    this.httpClient.interceptors.request.use((config) => {
      this.log('debug', 'Outgoing request to Rappi', {
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
    return DeliveryPlatformCode.RAPPI;
  }

  protected getDefaultBaseUrl(): string {
    // Argentina endpoint
    return process.env.RAPPI_API_URL || 'https://services.rappi.com.ar/api/v1';
  }

  /**
   * Valida la firma HMAC del webhook de Rappi.
   * Rappi usa HMAC-SHA256 con el body raw.
   */
  validateWebhookSignature(signature: string, rawBody: Buffer): boolean {
    if (!this.config.webhookSecret) {
      this.log('error', 'Cannot validate signature: webhookSecret not configured');
      return false;
    }

    const expectedSignature = this.computeHmac(rawBody, this.config.webhookSecret, 'sha256');
    const isValid = this.timingSafeEqual(signature, expectedSignature);

    if (!isValid) {
      this.log('warn', 'Webhook signature validation failed', {
        receivedLength: signature.length,
        expectedLength: expectedSignature.length,
      });
    }

    return isValid;
  }

  /**
   * Parsea el payload del webhook de Rappi al formato normalizado.
   */
  parseWebhookPayload(rawPayload: unknown): ProcessedWebhook {
    const payload = rawPayload as RappiOrderPayload;
    
    // Determinar tipo de evento
    const eventType = this.determineEventType(payload);
    
    // Convertir a formato normalizado
    const order = this.normalizeOrder(payload);

    return {
      eventType,
      platform: DeliveryPlatformCode.RAPPI,
      externalOrderId: payload.order_id,
      order,
      receivedAt: new Date(),
      rawPayload,
    };
  }

  /**
   * Acepta un pedido en Rappi.
   */
  async acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void> {
    try {
      await this.httpClient.post(`/orders/${externalOrderId}/accept`, {
        estimated_time_minutes: estimatedPrepTime,
      });
      
      this.log('info', 'Order accepted in Rappi', { externalOrderId, estimatedPrepTime });
    } catch (error) {
      this.log('error', 'Failed to accept order in Rappi', {
        externalOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Rechaza un pedido en Rappi.
   */
  async rejectOrder(externalOrderId: string, reason: string): Promise<void> {
    try {
      await this.httpClient.post(`/orders/${externalOrderId}/reject`, {
        reason,
      });
      
      this.log('info', 'Order rejected in Rappi', { externalOrderId, reason });
    } catch (error) {
      this.log('error', 'Failed to reject order in Rappi', {
        externalOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Actualiza el estado del pedido en Rappi.
   */
  async updateOrderStatus(
    externalOrderId: string,
    status: NormalizedOrderStatus
  ): Promise<StatusUpdateResult> {
    const rappiStatus = NORMALIZED_TO_RAPPI_STATUS[status];
    
    if (!rappiStatus) {
      return {
        success: false,
        externalId: externalOrderId,
        newStatus: status,
        error: `Unknown status mapping for: ${status}`,
      };
    }

    try {
      await this.httpClient.patch(`/orders/${externalOrderId}/status`, {
        status: rappiStatus,
      });
      
      this.log('info', 'Order status updated in Rappi', { externalOrderId, status: rappiStatus });
      
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
   * Envía el menú a Rappi.
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

    // Rappi espera el menú en un formato específico
    const rappiMenu = {
      categories: this.groupProductsByCategory(products),
      updated_at: new Date().toISOString(),
    };

    try {
      await this.httpClient.put(`/stores/${this.config.storeId}/menu`, rappiMenu);
      syncedProducts = products.length;
      
      this.log('info', 'Menu synced to Rappi', { productCount: syncedProducts });
    } catch (error) {
      this.log('error', 'Failed to sync menu to Rappi', {
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
   * Actualiza disponibilidad de un producto en Rappi.
   */
  async updateProductAvailability(update: AvailabilityUpdate): Promise<void> {
    try {
      await this.httpClient.patch(
        `/stores/${this.config.storeId}/products/${update.externalSku}/availability`,
        { is_available: update.isAvailable }
      );
      
      this.log('info', 'Product availability updated in Rappi', {
        externalSku: update.externalSku,
        isAvailable: update.isAvailable,
      });
    } catch (error) {
      this.log('error', 'Failed to update product availability in Rappi', {
        externalSku: update.externalSku,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // MÉTODOS PRIVADOS DE NORMALIZACIÓN
  // ============================================================================

  private determineEventType(payload: RappiOrderPayload): WebhookEventType {
    const status = payload.status?.toUpperCase();
    
    if (status === 'NEW') return WebhookEventType.ORDER_NEW;
    if (status === 'CANCELLED') return WebhookEventType.ORDER_CANCELLED;
    return WebhookEventType.STATUS_UPDATE;
  }

  private normalizeOrder(payload: RappiOrderPayload): NormalizedOrder {
    return {
      externalId: payload.order_id,
      platform: DeliveryPlatformCode.RAPPI,
      displayNumber: payload.order_number,
      status: RAPPI_STATUS_MAP[payload.status?.toUpperCase()] || NormalizedOrderStatus.NEW,
      createdAt: new Date(payload.created_at),
      fulfillmentType: 'PLATFORM_DELIVERY',
      
      customer: this.normalizeCustomer(payload.customer),
      deliveryAddress: payload.delivery_address 
        ? this.normalizeAddress(payload.delivery_address) 
        : undefined,
      
      items: payload.items.map((item) => this.normalizeItem(item)),
      
      subtotal: payload.totals.subtotal,
      deliveryFee: payload.totals.delivery_fee,
      discount: payload.totals.discount,
      tip: payload.totals.tip,
      total: payload.totals.total,
      
      estimatedDeliveryAt: payload.estimated_delivery_time 
        ? new Date(payload.estimated_delivery_time) 
        : undefined,
        
      notes: payload.notes,
      paymentMethod: payload.payment.method,
      isPrepaid: payload.payment.is_prepaid,
      
      rawPayload: payload,
    };
  }

  private normalizeCustomer(customer: RappiOrderPayload['customer']): NormalizedCustomer {
    return {
      externalId: customer.id,
      name: `${customer.first_name} ${customer.last_name}`.trim(),
      phone: customer.phone,
      email: customer.email,
    };
  }

  private normalizeAddress(
    address: NonNullable<RappiOrderPayload['delivery_address']>
  ): NormalizedAddress {
    return {
      fullAddress: [address.address, address.address_two, address.city]
        .filter(Boolean)
        .join(', '),
      street: address.address,
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
      instructions: address.instructions,
    };
  }

  private normalizeItem(item: RappiOrderPayload['items'][0]): NormalizedOrderItem {
    return {
      externalSku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      notes: item.comments,
      modifiers: (item.toppings || []).map((t) => ({
        externalSku: t.sku,
        name: t.name,
        price: t.price,
        quantity: t.quantity,
      })),
      removedIngredients: [], // Rappi manda esto en comments normalmente
    };
  }

  private groupProductsByCategory(
    products: Array<{ categoryName: string; [key: string]: unknown }>
  ): Array<{ name: string; products: unknown[] }> {
    const categoryMap = new Map<string, unknown[]>();
    
    for (const product of products) {
      const existing = categoryMap.get(product.categoryName) || [];
      existing.push({
        sku: product.externalSku,
        name: product.name,
        description: product.description,
        price: product.price,
        is_available: product.isAvailable,
        image_url: product.imageUrl,
      });
      categoryMap.set(product.categoryName, existing);
    }
    
    return Array.from(categoryMap.entries()).map(([name, prods]) => ({
      name,
      products: prods,
    }));
  }
}
