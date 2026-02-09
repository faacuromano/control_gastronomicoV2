/**
 * @fileoverview PedidosYa Partner API v2.0.2 Adapter
 *
 * Adapter for the PedidosYa Partner API v2, the current official API
 * post Delivery Hero acquisition.
 *
 * Key differences from legacy v3:
 * - snake_case payloads with UUID order IDs
 * - Static token webhook validation (not HMAC)
 * - Single PUT endpoint for all order operations
 * - Async catalog sync with job tracking
 * - OAuth uses separate client_id (app-level) and client_secret (per-tenant)
 *
 * @see https://developer.pedidosya.com/api-specifications
 * @module integrations/delivery/adapters/PedidosYaAdapter
 */

import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import crypto from 'crypto';
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
// ZOD SCHEMAS — Partner API v2.0.2 snake_case format
// ============================================================================

const PeYaCustomerSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  phone_number: z.string().optional(),
  delivery_address: z.string().optional(),
});

const PeYaItemPricingSchema = z.object({
  quantity: z.number(),
  unit_price: z.number(),
});

const PeYaItemSchema = z.object({
  sku: z.string(),
  name: z.string().optional(),
  pricing: PeYaItemPricingSchema,
  notes: z.string().optional(),
});

const PeYaPaymentSchema = z.object({
  order_total: z.number(),
  sub_total: z.number(),
  delivery_fee: z.number().default(0),
  discounts: z.number().default(0),
  tip: z.number().default(0),
  payment_method: z.string().optional(),
  is_prepaid: z.boolean().optional(),
});

const PeYaSysSchema = z.object({
  created_at: z.string(),
});

const PeYaClientSchema = z.object({
  chain_id: z.string(),
  store_id: z.string().optional(),
});

const PeYaOrderPayloadSchema = z.object({
  order_id: z.string().uuid(),
  order_code: z.string().optional(),
  status: z.string(),
  order_type: z.string().optional(),
  transport_type: z.string().optional(),
  client: PeYaClientSchema.optional(),
  customer: PeYaCustomerSchema,
  items: z.array(PeYaItemSchema),
  payment: PeYaPaymentSchema,
  sys: PeYaSysSchema,
  promised_for: z.string().optional(),
  accepted_for: z.string().optional(),
  notes: z.string().optional(),
});

type PeYaOrderPayload = z.infer<typeof PeYaOrderPayloadSchema>;

// ============================================================================
// STATUS MAPPINGS — Partner API v2 documented statuses
// ============================================================================

/**
 * Inbound: PedidosYa Partner API v2 status -> internal NormalizedOrderStatus.
 */
const PEDIDOSYA_STATUS_MAP: Record<string, NormalizedOrderStatus> = {
  'RECEIVED': NormalizedOrderStatus.NEW,
  'ACCEPTED': NormalizedOrderStatus.ACCEPTED,
  'READY_FOR_PICKUP': NormalizedOrderStatus.READY,
  'DISPATCHED': NormalizedOrderStatus.PICKED_UP,
  'CANCELLED': NormalizedOrderStatus.CANCELLED,
};

/**
 * Outbound: internal NormalizedOrderStatus -> PedidosYa Partner API v2 status.
 * Only statuses that can be sent outbound are mapped. NEW and DELIVERED are
 * platform-managed and have no outbound mapping.
 */
const NORMALIZED_TO_PEDIDOSYA_STATUS: Partial<Record<NormalizedOrderStatus, string>> = {
  [NormalizedOrderStatus.ACCEPTED]: 'ACCEPTED',
  [NormalizedOrderStatus.IN_PREPARATION]: 'ACCEPTED',
  [NormalizedOrderStatus.READY]: 'READY_FOR_PICKUP',
  [NormalizedOrderStatus.ON_ROUTE]: 'DISPATCHED',
  [NormalizedOrderStatus.PICKED_UP]: 'DISPATCHED',
  [NormalizedOrderStatus.CANCELLED]: 'CANCELLED',
  [NormalizedOrderStatus.REJECTED]: 'CANCELLED',
};

// ============================================================================
// ADAPTER
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

    // Interceptor: attach OAuth token and auto-refresh if expired
    this.httpClient.interceptors.request.use(async (reqConfig) => {
      await this.ensureValidToken();
      reqConfig.headers.Authorization = `Bearer ${this.accessToken}`;

      this.log('debug', 'Outgoing request to PedidosYa', {
        method: reqConfig.method,
        url: reqConfig.url,
      });
      return reqConfig;
    });
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================================================

  protected get platformCode(): DeliveryPlatformCode {
    return DeliveryPlatformCode.PEDIDOSYA;
  }

  protected getDefaultBaseUrl(): string {
    return process.env.PEDIDOSYA_API_URL || 'https://api.pedidosya.com/v2';
  }

  /**
   * Validates the webhook token using timing-safe string comparison.
   *
   * Partner API v2 uses a static token (not HMAC). The token is sent
   * in the `x-peya-token` header and must match the configured webhook secret.
   * Supports token rotation via comma-separated values in webhookSecret.
   *
   * @param signature - Token received in the x-peya-token header
   * @param _rawBody - Ignored (kept for interface compatibility)
   */
  validateWebhookSignature(signature: string, _rawBody: Buffer): boolean {
    if (!this.config.webhookSecret) {
      this.log('error', 'Cannot validate token: webhookSecret not configured');
      return false;
    }

    // Support token rotation via comma-separated values
    const tokens = this.config.webhookSecret.split(',').map(t => t.trim()).filter(Boolean);

    for (const token of tokens) {
      if (this.timingSafeEqual(signature, token)) {
        if (tokens.indexOf(token) > 0) {
          this.log('info', 'Webhook validated with previous token — rotation in progress', {
            tokenIndex: tokens.indexOf(token),
          });
        }
        return true;
      }
    }

    this.log('warn', 'Webhook token validation failed');
    return false;
  }

  /**
   * Parses a Partner API v2 webhook payload into normalized format.
   * v2 sends the order directly (no event wrapper).
   */
  parseWebhookPayload(rawPayload: unknown): ProcessedWebhook {
    const parsed = PeYaOrderPayloadSchema.safeParse(rawPayload);

    if (!parsed.success) {
      this.log('error', 'Invalid PedidosYa v2 webhook payload', {
        issues: parsed.error.issues,
      });
      throw new ValidationError(
        `Invalid PedidosYa webhook payload: ${parsed.error.message}`
      );
    }

    const payload = parsed.data;
    const eventType = this.determineEventType(payload);
    const order = this.normalizeOrder(payload);

    return {
      eventType,
      platform: DeliveryPlatformCode.PEDIDOSYA,
      externalOrderId: payload.order_id,
      order,
      receivedAt: new Date(),
      rawPayload,
    };
  }

  /**
   * Accepts an order via the single PUT endpoint.
   * Sends status ACCEPTED with accepted_for timestamp.
   */
  async acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void> {
    const chainId = this.config.storeId;
    const acceptedFor = new Date(Date.now() + estimatedPrepTime * 60 * 1000).toISOString();

    try {
      await this.httpClient.put(
        `/chains/${chainId}/orders/${externalOrderId}`,
        {
          status: 'ACCEPTED',
          accepted_for: acceptedFor,
          items: [],
        }
      );

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
   * Rejects an order via the single PUT endpoint.
   * Sends status CANCELLED with cancellation reason.
   */
  async rejectOrder(externalOrderId: string, reason: string): Promise<void> {
    const chainId = this.config.storeId;

    try {
      await this.httpClient.put(
        `/chains/${chainId}/orders/${externalOrderId}`,
        {
          status: 'CANCELLED',
          cancellation: { reason },
          items: [],
        }
      );

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
   * Updates order status via the single PUT endpoint.
   * All operations use PUT /chains/{chain_id}/orders/{order_id}.
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

    const chainId = this.config.storeId;

    try {
      await this.httpClient.put(
        `/chains/${chainId}/orders/${externalOrderId}`,
        {
          status: peyaStatus,
          items: [],
        }
      );

      this.log('info', 'Order status updated in PedidosYa', {
        externalOrderId,
        status: peyaStatus,
      });

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
   * Pushes the full catalog to PedidosYa using the async catalog endpoint.
   * Returns 202 with a job_id for tracking.
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

    const chainId = this.config.storeId;
    const vendorId = this.config.storeId;

    const catalog = products.map(p => ({
      sku: p.externalSku,
      name: p.name,
      description: p.description,
      price: p.price,
      active: p.isAvailable,
      quantity: p.isAvailable ? 999 : 0,
      image_url: p.imageUrl,
    }));

    try {
      await this.httpClient.put(
        `/chains/${chainId}/vendors/${vendorId}/catalog`,
        catalog
      );
      syncedProducts = products.length;

      this.log('info', 'Catalog synced to PedidosYa', { productCount: syncedProducts });
    } catch (error) {
      this.log('error', 'Failed to sync catalog to PedidosYa', {
        error: error instanceof Error ? error.message : String(error),
      });

      products.forEach((p) => {
        errors.push({ productId: p.productId, error: 'Catalog sync failed' });
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
   * Updates product availability via the catalog endpoint with a single-product array.
   */
  async updateProductAvailability(update: AvailabilityUpdate): Promise<void> {
    const chainId = this.config.storeId;
    const vendorId = this.config.storeId;

    try {
      await this.httpClient.put(
        `/chains/${chainId}/vendors/${vendorId}/catalog`,
        [
          {
            sku: update.externalSku,
            active: update.isAvailable,
            quantity: update.isAvailable ? 999 : 0,
          },
        ]
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

  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }
    await this.refreshAccessToken();
  }

  /**
   * Obtains a new access token using OAuth Client Credentials flow.
   * client_id comes from PEDIDOSYA_CLIENT_ID env var (app-level).
   * client_secret comes from config.apiKey (per-tenant).
   */
  private async refreshAccessToken(): Promise<void> {
    const clientId = process.env.PEDIDOSYA_CLIENT_ID;

    if (!clientId) {
      throw new Error('PEDIDOSYA_CLIENT_ID environment variable is not set');
    }

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: this.config.apiKey,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      this.accessToken = response.data.access_token;
      // Expire 5 minutes early to avoid using tokens about to expire
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
  // NORMALIZATION — v2 snake_case fields to internal format
  // ============================================================================

  private determineEventType(payload: PeYaOrderPayload): WebhookEventType {
    const status = payload.status.toUpperCase();

    if (status === 'RECEIVED') return WebhookEventType.ORDER_NEW;
    if (status === 'CANCELLED') return WebhookEventType.ORDER_CANCELLED;

    return WebhookEventType.STATUS_UPDATE;
  }

  private normalizeOrder(payload: PeYaOrderPayload): NormalizedOrder {
    const orderType = payload.order_type?.toUpperCase();
    const transportType = payload.transport_type?.toUpperCase();

    // Determine fulfillment from order_type and transport_type
    let fulfillmentType: 'PLATFORM_DELIVERY' | 'SELF_DELIVERY' | 'TAKEAWAY';
    if (orderType === 'PICKUP' || transportType === 'PICKUP') {
      fulfillmentType = 'TAKEAWAY';
    } else if (transportType === 'OWN_DELIVERY' || transportType === 'MERCHANT') {
      fulfillmentType = 'SELF_DELIVERY';
    } else {
      fulfillmentType = 'PLATFORM_DELIVERY';
    }

    return {
      externalId: payload.order_id,
      platform: DeliveryPlatformCode.PEDIDOSYA,
      displayNumber: payload.order_code || payload.order_id.substring(0, 8),
      status: PEDIDOSYA_STATUS_MAP[payload.status.toUpperCase()] || NormalizedOrderStatus.NEW,
      createdAt: new Date(payload.sys.created_at),
      fulfillmentType,

      customer: this.normalizeCustomer(payload.customer),
      deliveryAddress: payload.customer.delivery_address && fulfillmentType !== 'TAKEAWAY'
        ? this.normalizeAddress(payload.customer.delivery_address)
        : undefined,

      items: payload.items.map((item) => this.normalizeItem(item)),

      subtotal: payload.payment.sub_total,
      deliveryFee: payload.payment.delivery_fee,
      discount: payload.payment.discounts,
      tip: payload.payment.tip,
      total: payload.payment.order_total,

      estimatedDeliveryAt: payload.promised_for
        ? new Date(payload.promised_for)
        : undefined,

      notes: payload.notes,
      paymentMethod: (payload.payment.payment_method?.toUpperCase() || 'ONLINE') as 'ONLINE' | 'CASH' | 'CARD',
      isPrepaid: payload.payment.is_prepaid ?? true,

      ...(payload.client?.store_id || payload.client?.chain_id
        ? { storeId: payload.client.store_id || payload.client.chain_id }
        : {}),

      rawPayload: payload,
    };
  }

  private normalizeCustomer(customer: PeYaOrderPayload['customer']): NormalizedCustomer {
    return {
      externalId: '',  // v2 does not provide a customer ID
      name: `${customer.first_name} ${customer.last_name}`.trim(),
      phone: customer.phone_number,
    };
  }

  private normalizeAddress(address: string): NormalizedAddress {
    return {
      fullAddress: address,
      street: address,
    };
  }

  private normalizeItem(item: PeYaOrderPayload['items'][0]): NormalizedOrderItem {
    return {
      externalSku: item.sku,
      name: item.name || item.sku,
      quantity: item.pricing.quantity,
      unitPrice: item.pricing.unit_price,
      notes: item.notes,
      modifiers: [],
      removedIngredients: [],
    };
  }
}
