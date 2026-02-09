/**
 * TST-001: Delivery Adapter Error Recovery Tests
 *
 * Verifies that delivery adapters handle external API failures gracefully:
 * - 500 errors from Rappi/PedidosYa APIs
 * - Network timeouts
 * - Invalid payloads
 * - HMAC validation failures
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { RappiAdapter } from '../../src/integrations/delivery/adapters/RappiAdapter';
import { PedidosYaAdapter } from '../../src/integrations/delivery/adapters/PedidosYaAdapter';
import {
  DeliveryPlatformCode,
  NormalizedOrderStatus,
  WebhookEventType,
} from '../../src/integrations/delivery/types/normalized.types';
import type { DeliveryPlatform } from '@prisma/client';
import crypto from 'crypto';

// ============================================================================
// FIXTURES
// ============================================================================

const mockPlatform: DeliveryPlatform = {
  id: 1,
  code: 'RAPPI',
  name: 'Rappi',
  isEnabled: true,
  apiKey: 'test-api-key',
  webhookSecret: 'test-webhook-secret',
  storeId: 'STORE-001',
  tenantId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validRappiPayload = {
  order_id: 'RAPPI-12345',
  order_number: 'R-001',
  status: 'NEW',
  created_at: '2026-01-15T10:00:00Z',
  customer: {
    id: 'CUST-1',
    first_name: 'Juan',
    last_name: 'Perez',
    phone: '+5491112345678',
  },
  delivery_address: {
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    latitude: -34.6037,
    longitude: -58.3816,
  },
  items: [
    { sku: 'PIZZA-001', name: 'Muzzarella', quantity: 2, unit_price: 1500 },
  ],
  totals: { subtotal: 3000, delivery_fee: 200, discount: 0, tip: 100, total: 3300 },
  payment: { method: 'ONLINE' as const, is_prepaid: true },
  notes: 'Sin cebolla',
};

// ============================================================================
// TESTS
// ============================================================================

describe('TST-001: Delivery Adapter Error Recovery', () => {
  let adapter: RappiAdapter;

  beforeAll(() => {
    adapter = new RappiAdapter(mockPlatform);
  });

  // --------------------------------------------------------------------------
  // HMAC Validation
  // --------------------------------------------------------------------------

  describe('HMAC Webhook Validation', () => {
    it('should accept valid HMAC signature', () => {
      const body = Buffer.from(JSON.stringify(validRappiPayload));
      const expectedSig = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(body)
        .digest('hex');

      expect(adapter.validateWebhookSignature(expectedSig, body)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      const body = Buffer.from(JSON.stringify(validRappiPayload));
      expect(adapter.validateWebhookSignature('invalid-signature', body)).toBe(false);
    });

    it('should reject tampered payload', () => {
      const body = Buffer.from(JSON.stringify(validRappiPayload));
      const sig = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(body)
        .digest('hex');

      const tamperedBody = Buffer.from(JSON.stringify({ ...validRappiPayload, totals: { ...validRappiPayload.totals, total: 0 } }));
      expect(adapter.validateWebhookSignature(sig, tamperedBody)).toBe(false);
    });

    it('should reject if webhookSecret is not configured', () => {
      const noSecretPlatform = { ...mockPlatform, webhookSecret: '' };
      const noSecretAdapter = new RappiAdapter(noSecretPlatform as DeliveryPlatform);
      const body = Buffer.from('{}');
      expect(noSecretAdapter.validateWebhookSignature('any-sig', body)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Payload Parsing
  // --------------------------------------------------------------------------

  describe('Webhook Payload Parsing', () => {
    it('should parse valid Rappi payload to normalized format', () => {
      const result = adapter.parseWebhookPayload(validRappiPayload);

      expect(result.eventType).toBe(WebhookEventType.ORDER_NEW);
      expect(result.platform).toBe(DeliveryPlatformCode.RAPPI);
      expect(result.externalOrderId).toBe('RAPPI-12345');
      expect(result.order).toBeDefined();
      expect(result.order!.items).toHaveLength(1);
      expect(result.order!.total).toBe(3300);
      expect(result.order!.customer.name).toBe('Juan Perez');
      expect(result.order!.isPrepaid).toBe(true);
    });

    it('should map CANCELLED status to ORDER_CANCELLED event', () => {
      const cancelledPayload = { ...validRappiPayload, status: 'CANCELLED' };
      const result = adapter.parseWebhookPayload(cancelledPayload);
      expect(result.eventType).toBe(WebhookEventType.ORDER_CANCELLED);
    });

    it('should map unknown status to STATUS_UPDATE event', () => {
      const updatedPayload = { ...validRappiPayload, status: 'ACCEPTED' };
      const result = adapter.parseWebhookPayload(updatedPayload);
      expect(result.eventType).toBe(WebhookEventType.STATUS_UPDATE);
    });

    it('should throw on missing required fields', () => {
      const invalidPayload = { order_id: 'X' }; // Missing most fields
      expect(() => adapter.parseWebhookPayload(invalidPayload)).toThrow();
    });

    it('should throw on invalid item structure', () => {
      const badItems = {
        ...validRappiPayload,
        items: [{ sku: 'X' }], // Missing quantity, unit_price, name
      };
      expect(() => adapter.parseWebhookPayload(badItems)).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Status Mapping
  // --------------------------------------------------------------------------

  describe('Status Mapping', () => {
    it('should map all known Rappi statuses', () => {
      const statuses = ['NEW', 'ACCEPTED', 'IN_STORE', 'READY_FOR_PICKUP', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'REJECTED'];
      for (const status of statuses) {
        const payload = { ...validRappiPayload, status };
        const result = adapter.parseWebhookPayload(payload);
        expect(result.order!.status).toBeDefined();
      }
    });

    it('should default unknown status to NEW', () => {
      const payload = { ...validRappiPayload, status: 'UNKNOWN_STATUS' };
      const result = adapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.NEW);
    });
  });

  // --------------------------------------------------------------------------
  // Adapter Configuration
  // --------------------------------------------------------------------------

  describe('Adapter Configuration', () => {
    it('should report fully configured when all fields present', () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should report not configured when apiKey missing', () => {
      const partial = { ...mockPlatform, apiKey: '' };
      const partialAdapter = new RappiAdapter(partial as DeliveryPlatform);
      expect(partialAdapter.isConfigured()).toBe(false);
    });

    it('should return correct adapter name', () => {
      expect(adapter.getName()).toBe('RAPPIAdapter');
    });
  });

  // --------------------------------------------------------------------------
  // External API Error Handling (acceptOrder, rejectOrder, updateOrderStatus)
  // --------------------------------------------------------------------------

  describe('External API Error Handling', () => {
    it('should propagate errors from acceptOrder', async () => {
      // The httpClient will fail since there's no real Rappi server
      await expect(adapter.acceptOrder('FAKE-ORDER', 15)).rejects.toThrow();
    });

    it('should propagate errors from rejectOrder', async () => {
      await expect(adapter.rejectOrder('FAKE-ORDER', 'Test rejection')).rejects.toThrow();
    });

    it('should return failure result from updateOrderStatus on network error', async () => {
      const result = await adapter.updateOrderStatus('FAKE-ORDER', NormalizedOrderStatus.ACCEPTED);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return failure for unmapped status in updateOrderStatus', async () => {
      const result = await adapter.updateOrderStatus('FAKE-ORDER', 'INVALID' as NormalizedOrderStatus);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown status mapping');
    });
  });
});

// ============================================================================
// PEDIDOSYA PARTNER API v2 ADAPTER
// ============================================================================

const mockPeYaPlatform: DeliveryPlatform = {
  id: 2,
  code: 'PEDIDOSYA',
  name: 'PedidosYa',
  isEnabled: true,
  apiKey: 'test-peya-api-key',
  webhookSecret: 'test-peya-webhook-token',
  storeId: 'CHAIN-001',
  tenantId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validPeYaOrderId = '550e8400-e29b-41d4-a716-446655440000';

const validPeYaPayload = {
  order_id: validPeYaOrderId,
  order_code: 'PY-1234',
  status: 'RECEIVED',
  order_type: 'DELIVERY',
  transport_type: 'PEYA',
  client: {
    chain_id: 'CHAIN-001',
    store_id: 'STORE-001',
  },
  customer: {
    first_name: 'Maria',
    last_name: 'Garcia',
    phone_number: '+5491156789012',
    delivery_address: 'Av. Santa Fe 2000, CABA',
  },
  items: [
    {
      sku: 'EMPANADA-001',
      name: 'Empanada de Carne',
      pricing: { quantity: 3, unit_price: 800 },
    },
    {
      sku: 'BEBIDA-002',
      name: 'Coca-Cola 500ml',
      pricing: { quantity: 1, unit_price: 600 },
      notes: 'Bien fria',
    },
  ],
  payment: {
    order_total: 3400,
    sub_total: 3000,
    delivery_fee: 300,
    discounts: 0,
    tip: 100,
    payment_method: 'ONLINE',
    is_prepaid: true,
  },
  sys: {
    created_at: '2026-02-09T14:30:00Z',
  },
  promised_for: '2026-02-09T15:15:00Z',
  notes: 'Tocar timbre 2B',
};

describe('PedidosYa Partner API v2 Adapter', () => {
  let peyaAdapter: PedidosYaAdapter;

  beforeAll(() => {
    peyaAdapter = new PedidosYaAdapter(mockPeYaPlatform);
  });

  // --------------------------------------------------------------------------
  // Static Token Validation
  // --------------------------------------------------------------------------

  describe('Static Token Webhook Validation', () => {
    it('should accept valid static token', () => {
      const body = Buffer.from(JSON.stringify(validPeYaPayload));
      expect(
        peyaAdapter.validateWebhookSignature('test-peya-webhook-token', body)
      ).toBe(true);
    });

    it('should reject mismatched token', () => {
      const body = Buffer.from(JSON.stringify(validPeYaPayload));
      expect(
        peyaAdapter.validateWebhookSignature('wrong-token', body)
      ).toBe(false);
    });

    it('should support token rotation with comma-separated values', () => {
      const rotationPlatform = {
        ...mockPeYaPlatform,
        webhookSecret: 'new-token-2026,test-peya-webhook-token',
      };
      const rotationAdapter = new PedidosYaAdapter(rotationPlatform as DeliveryPlatform);
      const body = Buffer.from('{}');

      // Primary token works
      expect(rotationAdapter.validateWebhookSignature('new-token-2026', body)).toBe(true);
      // Previous token also works during rotation
      expect(rotationAdapter.validateWebhookSignature('test-peya-webhook-token', body)).toBe(true);
      // Unknown token still rejected
      expect(rotationAdapter.validateWebhookSignature('unknown', body)).toBe(false);
    });

    it('should reject if webhookSecret is not configured', () => {
      const noSecretPlatform = { ...mockPeYaPlatform, webhookSecret: '' };
      const noSecretAdapter = new PedidosYaAdapter(noSecretPlatform as DeliveryPlatform);
      const body = Buffer.from('{}');
      expect(noSecretAdapter.validateWebhookSignature('any-token', body)).toBe(false);
    });

    it('should ignore rawBody (static token, not HMAC)', () => {
      const body1 = Buffer.from('{"different": "payload1"}');
      const body2 = Buffer.from('{"different": "payload2"}');
      // Same token validates regardless of body content
      expect(peyaAdapter.validateWebhookSignature('test-peya-webhook-token', body1)).toBe(true);
      expect(peyaAdapter.validateWebhookSignature('test-peya-webhook-token', body2)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Payload Parsing (v2 snake_case format)
  // --------------------------------------------------------------------------

  describe('v2 Webhook Payload Parsing', () => {
    it('should parse valid v2 payload to normalized format', () => {
      const result = peyaAdapter.parseWebhookPayload(validPeYaPayload);

      expect(result.eventType).toBe(WebhookEventType.ORDER_NEW);
      expect(result.platform).toBe(DeliveryPlatformCode.PEDIDOSYA);
      expect(result.externalOrderId).toBe(validPeYaOrderId);
      expect(result.order).toBeDefined();
      expect(result.order!.items).toHaveLength(2);
      expect(result.order!.total).toBe(3400);
      expect(result.order!.subtotal).toBe(3000);
      expect(result.order!.deliveryFee).toBe(300);
      expect(result.order!.tip).toBe(100);
      expect(result.order!.customer.name).toBe('Maria Garcia');
      expect(result.order!.customer.phone).toBe('+5491156789012');
      expect(result.order!.isPrepaid).toBe(true);
      expect(result.order!.displayNumber).toBe('PY-1234');
      expect(result.order!.fulfillmentType).toBe('PLATFORM_DELIVERY');
      expect(result.order!.notes).toBe('Tocar timbre 2B');
    });

    it('should normalize items with v2 pricing structure', () => {
      const result = peyaAdapter.parseWebhookPayload(validPeYaPayload);
      const items = result.order!.items;

      expect(items[0]!.externalSku).toBe('EMPANADA-001');
      expect(items[0]!.quantity).toBe(3);
      expect(items[0]!.unitPrice).toBe(800);
      expect(items[1]!.notes).toBe('Bien fria');
    });

    it('should normalize delivery address from customer string field', () => {
      const result = peyaAdapter.parseWebhookPayload(validPeYaPayload);
      expect(result.order!.deliveryAddress).toBeDefined();
      expect(result.order!.deliveryAddress!.fullAddress).toBe('Av. Santa Fe 2000, CABA');
    });

    it('should detect TAKEAWAY fulfillment from order_type PICKUP', () => {
      const pickupPayload = { ...validPeYaPayload, order_type: 'PICKUP' };
      const result = peyaAdapter.parseWebhookPayload(pickupPayload);
      expect(result.order!.fulfillmentType).toBe('TAKEAWAY');
      expect(result.order!.deliveryAddress).toBeUndefined();
    });

    it('should detect SELF_DELIVERY from transport_type OWN_DELIVERY', () => {
      const selfDeliveryPayload = { ...validPeYaPayload, transport_type: 'OWN_DELIVERY' };
      const result = peyaAdapter.parseWebhookPayload(selfDeliveryPayload);
      expect(result.order!.fulfillmentType).toBe('SELF_DELIVERY');
    });

    it('should use order_id prefix as displayNumber when order_code is missing', () => {
      const { order_code, ...noCodePayload } = validPeYaPayload;
      const result = peyaAdapter.parseWebhookPayload(noCodePayload);
      expect(result.order!.displayNumber).toBe(validPeYaOrderId.substring(0, 8));
    });

    it('should throw on invalid UUID order_id', () => {
      const badPayload = { ...validPeYaPayload, order_id: 'not-a-uuid' };
      expect(() => peyaAdapter.parseWebhookPayload(badPayload)).toThrow();
    });

    it('should throw on missing required fields', () => {
      const invalidPayload = { order_id: validPeYaOrderId };
      expect(() => peyaAdapter.parseWebhookPayload(invalidPayload)).toThrow();
    });

    it('should throw on missing customer', () => {
      const { customer, ...noCustomer } = validPeYaPayload;
      expect(() => peyaAdapter.parseWebhookPayload(noCustomer)).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Status Mapping (v2 documented statuses)
  // --------------------------------------------------------------------------

  describe('v2 Status Mapping', () => {
    it('should map RECEIVED to NEW', () => {
      const payload = { ...validPeYaPayload, status: 'RECEIVED' };
      const result = peyaAdapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.NEW);
      expect(result.eventType).toBe(WebhookEventType.ORDER_NEW);
    });

    it('should map ACCEPTED to ACCEPTED', () => {
      const payload = { ...validPeYaPayload, status: 'ACCEPTED' };
      const result = peyaAdapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.ACCEPTED);
      expect(result.eventType).toBe(WebhookEventType.STATUS_UPDATE);
    });

    it('should map READY_FOR_PICKUP to READY', () => {
      const payload = { ...validPeYaPayload, status: 'READY_FOR_PICKUP' };
      const result = peyaAdapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.READY);
    });

    it('should map DISPATCHED to PICKED_UP', () => {
      const payload = { ...validPeYaPayload, status: 'DISPATCHED' };
      const result = peyaAdapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.PICKED_UP);
    });

    it('should map CANCELLED to CANCELLED', () => {
      const payload = { ...validPeYaPayload, status: 'CANCELLED' };
      const result = peyaAdapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.CANCELLED);
      expect(result.eventType).toBe(WebhookEventType.ORDER_CANCELLED);
    });

    it('should default unknown status to NEW', () => {
      const payload = { ...validPeYaPayload, status: 'UNKNOWN_V2_STATUS' };
      const result = peyaAdapter.parseWebhookPayload(payload);
      expect(result.order!.status).toBe(NormalizedOrderStatus.NEW);
    });
  });

  // --------------------------------------------------------------------------
  // Adapter Configuration
  // --------------------------------------------------------------------------

  describe('PedidosYa Adapter Configuration', () => {
    it('should report fully configured when all fields present', () => {
      expect(peyaAdapter.isConfigured()).toBe(true);
    });

    it('should report not configured when apiKey missing', () => {
      const partial = { ...mockPeYaPlatform, apiKey: '' };
      const partialAdapter = new PedidosYaAdapter(partial as DeliveryPlatform);
      expect(partialAdapter.isConfigured()).toBe(false);
    });

    it('should return correct adapter name', () => {
      expect(peyaAdapter.getName()).toBe('PEDIDOSYAAdapter');
    });
  });

  // --------------------------------------------------------------------------
  // External API Error Handling
  // --------------------------------------------------------------------------

  describe('PedidosYa External API Error Handling', () => {
    it('should return failure result from updateOrderStatus on network error', async () => {
      const result = await peyaAdapter.updateOrderStatus('FAKE-ORDER', NormalizedOrderStatus.ACCEPTED);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return failure for unmapped status (NEW is platform-managed)', async () => {
      const result = await peyaAdapter.updateOrderStatus('FAKE-ORDER', NormalizedOrderStatus.NEW);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown status mapping');
    });

    it('should return failure for unmapped status (DELIVERED is platform-managed)', async () => {
      const result = await peyaAdapter.updateOrderStatus('FAKE-ORDER', NormalizedOrderStatus.DELIVERED);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown status mapping');
    });
  });
});
