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
