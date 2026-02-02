/**
 * TST-004: Concurrent Order Sequence Tests
 *
 * Verifies that order number generation is safe under concurrent access:
 * - Parallel order creations produce unique, sequential numbers
 * - No duplicates even under race conditions
 * - Retry logic in OrderNumberService handles deadlocks
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../src/lib/prisma';
import { OrderService } from '../../src/services/order.service';

// ============================================================================
// SETUP
// ============================================================================

const TENANT_CODE = 'TST004_CONCURRENT';

let tenantId: number;
let userId: number;
let productId: number;

const orderService = new OrderService();

beforeAll(async () => {
  // Clean previous test data
  const existing = await prisma.tenant.findFirst({ where: { code: TENANT_CODE } });
  if (existing) {
    await prisma.stockMovement.deleteMany({ where: { tenantId: existing.id } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId: existing.id } } });
    await prisma.payment.deleteMany({ where: { order: { tenantId: existing.id } } });
    await prisma.order.deleteMany({ where: { tenantId: existing.id } });
    await prisma.productIngredient.deleteMany({ where: { tenantId: existing.id } });
    await prisma.ingredient.deleteMany({ where: { tenantId: existing.id } });
    await prisma.product.deleteMany({ where: { tenantId: existing.id } });
    await prisma.category.deleteMany({ where: { tenantId: existing.id } });
    await prisma.orderSequence.deleteMany({ where: { tenantId: existing.id } });
    await prisma.cashShift.deleteMany({ where: { tenantId: existing.id } });
    await prisma.user.deleteMany({ where: { tenantId: existing.id } });
    await prisma.role.deleteMany({ where: { tenantId: existing.id } });
    await prisma.tenantConfig.deleteMany({ where: { tenantId: existing.id } });
    await prisma.tenant.delete({ where: { id: existing.id } });
  }

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: { name: 'Concurrent Test', code: TENANT_CODE, activeSubscription: true }
  });
  tenantId = tenant.id;

  // Create role + user
  const role = await prisma.role.create({
    data: { name: 'WAITER', tenantId, permissions: {} }
  });
  const user = await prisma.user.create({
    data: { name: 'Concurrency Tester', pinHash: '$2a$10$test', roleId: role.id, tenantId }
  });
  userId = user.id;

  // Create shift
  await prisma.cashShift.create({
    data: { userId, startAmount: 1000, startTime: new Date(), businessDate: new Date(), tenantId }
  });

  // Create category + product (non-stockable to avoid stock contention)
  const cat = await prisma.category.create({ data: { name: 'Drinks', tenantId } });
  const prod = await prisma.product.create({
    data: { name: 'Water', price: 50, categoryId: cat.id, isStockable: false, tenantId }
  });
  productId = prod.id;
}, 15000);

afterAll(async () => {
  if (tenantId) {
    await prisma.stockMovement.deleteMany({ where: { tenantId } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
    await prisma.payment.deleteMany({ where: { order: { tenantId } } });
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.productIngredient.deleteMany({ where: { tenantId } });
    await prisma.ingredient.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.category.deleteMany({ where: { tenantId } });
    await prisma.orderSequence.deleteMany({ where: { tenantId } });
    await prisma.cashShift.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.tenantConfig.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  }
  await prisma.$disconnect();
}, 15000);

// ============================================================================
// TESTS
// ============================================================================

describe('TST-004: Concurrent Order Sequence', () => {

  it('should produce unique order numbers under concurrent creation', async () => {
    const CONCURRENT_COUNT = 5;

    // Spawn N order creations in parallel
    const promises = Array.from({ length: CONCURRENT_COUNT }, () =>
      orderService.createOrder({
        userId,
        items: [{ productId, quantity: 1 }],
        serverId: userId,
        channel: 'POS',
      })
    );

    const orders = await Promise.all(promises);

    // All should succeed
    expect(orders).toHaveLength(CONCURRENT_COUNT);

    // All order numbers should be unique
    const orderNumbers = orders.map(o => o.orderNumber);
    const uniqueNumbers = new Set(orderNumbers);
    expect(uniqueNumbers.size).toBe(CONCURRENT_COUNT);
  }, 30000);

  it('should produce strictly sequential numbers (no gaps)', async () => {
    // Get all orders for this tenant, sorted by orderNumber
    const orders = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { orderNumber: 'asc' },
      select: { orderNumber: true }
    });

    // Verify sequential (no gaps)
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]!.orderNumber).toBe(orders[i - 1]!.orderNumber + 1);
    }
  });

  it('should handle a second batch of concurrent orders after the first', async () => {
    const ordersBefore = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { orderNumber: 'desc' },
      take: 1,
      select: { orderNumber: true }
    });
    const lastNumber = ordersBefore[0]!.orderNumber;

    // Second batch
    const promises = Array.from({ length: 3 }, () =>
      orderService.createOrder({
        userId,
        items: [{ productId, quantity: 1 }],
        serverId: userId,
        channel: 'POS',
      })
    );

    const newOrders = await Promise.all(promises);
    const newNumbers = newOrders.map(o => o.orderNumber).sort((a, b) => a - b);

    // All new numbers should be after the last number
    expect(newNumbers[0]).toBe(lastNumber + 1);
    expect(newNumbers[newNumbers.length - 1]).toBe(lastNumber + 3);
  }, 30000);
});
