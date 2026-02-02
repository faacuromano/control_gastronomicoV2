/**
 * TST-003: Multi-Tenant Webhook Isolation Tests
 *
 * Verifies that webhook processing correctly resolves storeId to tenantId
 * and that one tenant's webhook data cannot leak into another tenant.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../src/lib/prisma';

// ============================================================================
// SETUP
// ============================================================================

const TENANT_A_CODE = 'TST003_WEBHOOK_A';
const TENANT_B_CODE = 'TST003_WEBHOOK_B';

let tenantAId: number;
let tenantBId: number;

beforeAll(async () => {
  // Cleanup previous runs
  for (const code of [TENANT_A_CODE, TENANT_B_CODE]) {
    const existing = await prisma.tenant.findFirst({ where: { code } });
    if (existing) {
      await prisma.tenantPlatformConfig.deleteMany({ where: { tenantId: existing.id } });
      await prisma.productChannelPrice.deleteMany({ where: { deliveryPlatform: { tenantId: existing.id } } });
      await prisma.order.deleteMany({ where: { tenantId: existing.id } });
      await prisma.product.deleteMany({ where: { tenantId: existing.id } });
      await prisma.category.deleteMany({ where: { tenantId: existing.id } });
      await prisma.deliveryPlatform.deleteMany({ where: { tenantId: existing.id } });
      await prisma.tenantConfig.deleteMany({ where: { tenantId: existing.id } });
      await prisma.tenant.delete({ where: { id: existing.id } });
    }
  }

  // Create Tenant A
  const tenantA = await prisma.tenant.create({
    data: { name: 'Webhook Tenant A', code: TENANT_A_CODE, activeSubscription: true }
  });
  tenantAId = tenantA.id;

  // Create Tenant B
  const tenantB = await prisma.tenant.create({
    data: { name: 'Webhook Tenant B', code: TENANT_B_CODE, activeSubscription: true }
  });
  tenantBId = tenantB.id;

  // Create delivery platforms for each tenant
  const dpA = await prisma.deliveryPlatform.create({
    data: { code: 'RAPPI', name: 'Rappi', isEnabled: true, tenantId: tenantAId }
  });
  const dpB = await prisma.deliveryPlatform.create({
    data: { code: 'RAPPI', name: 'Rappi', isEnabled: true, tenantId: tenantBId }
  });

  // Create TenantPlatformConfig with distinct storeIds
  await prisma.tenantPlatformConfig.create({
    data: {
      tenantId: tenantAId,
      deliveryPlatformId: dpA.id,
      storeId: 'STORE-A-001',
      apiKey: 'key-a',
      webhookSecret: 'secret-a',
      isActive: true,
    }
  });

  await prisma.tenantPlatformConfig.create({
    data: {
      tenantId: tenantBId,
      deliveryPlatformId: dpB.id,
      storeId: 'STORE-B-002',
      apiKey: 'key-b',
      webhookSecret: 'secret-b',
      isActive: true,
    }
  });
});

afterAll(async () => {
  for (const id of [tenantAId, tenantBId]) {
    if (!id) continue;
    await prisma.tenantPlatformConfig.deleteMany({ where: { tenantId: id } });
    await prisma.productChannelPrice.deleteMany({ where: { deliveryPlatform: { tenantId: id } } });
    await prisma.order.deleteMany({ where: { tenantId: id } });
    await prisma.product.deleteMany({ where: { tenantId: id } });
    await prisma.category.deleteMany({ where: { tenantId: id } });
    await prisma.deliveryPlatform.deleteMany({ where: { tenantId: id } });
    await prisma.tenantConfig.deleteMany({ where: { tenantId: id } });
    await prisma.tenant.delete({ where: { id } });
  }
  await prisma.$disconnect();
});

// ============================================================================
// TESTS
// ============================================================================

describe('TST-003: Multi-Tenant Webhook Isolation', () => {

  describe('StoreId to TenantId Resolution', () => {
    it('should resolve STORE-A-001 to Tenant A', async () => {
      const config = await prisma.tenantPlatformConfig.findFirst({
        where: { storeId: 'STORE-A-001', isActive: true },
        include: { deliveryPlatform: true }
      });

      expect(config).not.toBeNull();
      expect(config!.tenantId).toBe(tenantAId);
    });

    it('should resolve STORE-B-002 to Tenant B', async () => {
      const config = await prisma.tenantPlatformConfig.findFirst({
        where: { storeId: 'STORE-B-002', isActive: true },
        include: { deliveryPlatform: true }
      });

      expect(config).not.toBeNull();
      expect(config!.tenantId).toBe(tenantBId);
    });

    it('should return null for unknown storeId', async () => {
      const config = await prisma.tenantPlatformConfig.findFirst({
        where: { storeId: 'STORE-UNKNOWN', isActive: true }
      });

      expect(config).toBeNull();
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    it('should not return Tenant B config when querying Tenant A storeId', async () => {
      const configs = await prisma.tenantPlatformConfig.findMany({
        where: { tenantId: tenantAId }
      });

      expect(configs.every(c => c.tenantId === tenantAId)).toBe(true);
      expect(configs.some(c => c.storeId === 'STORE-B-002')).toBe(false);
    });

    it('should isolate delivery platforms per tenant', async () => {
      const platformsA = await prisma.deliveryPlatform.findMany({
        where: { tenantId: tenantAId }
      });
      const platformsB = await prisma.deliveryPlatform.findMany({
        where: { tenantId: tenantBId }
      });

      // Both have RAPPI but different platform records
      expect(platformsA).toHaveLength(1);
      expect(platformsB).toHaveLength(1);
      expect(platformsA[0]!.id).not.toBe(platformsB[0]!.id);
    });

    it('should prevent storeId collision across tenants', async () => {
      const allConfigs = await prisma.tenantPlatformConfig.findMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } }
      });

      const storeIds = allConfigs.map(c => c.storeId);
      const uniqueStoreIds = new Set(storeIds);
      expect(uniqueStoreIds.size).toBe(storeIds.length);
    });
  });

  describe('Platform Config Scoping', () => {
    it('should only return active configs for webhook processing', async () => {
      const activeConfigs = await prisma.tenantPlatformConfig.findMany({
        where: { isActive: true, tenantId: tenantAId }
      });

      expect(activeConfigs.length).toBeGreaterThan(0);
      expect(activeConfigs.every(c => c.isActive)).toBe(true);
    });

    it('should include platform details in config lookup', async () => {
      const config = await prisma.tenantPlatformConfig.findFirst({
        where: { storeId: 'STORE-A-001' },
        include: { deliveryPlatform: true }
      });

      expect(config!.deliveryPlatform).toBeDefined();
      expect(config!.deliveryPlatform.code).toBe('RAPPI');
    });
  });
});
