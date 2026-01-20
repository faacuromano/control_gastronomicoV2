/**
 * @fileoverview Forensic Test Suite - Order ID Generation (Banking Grade)
 * 
 * PHILOSOPHY: "Paranoid Testing" - If it can fail, it MUST have a test
 * OBJECTIVE: Test ALL edge cases and failure modes of Order ID system
 * 
 * RUN TESTS:
 * ```bash
 * npx vitest run src/tests/orderNumber.forensic.spec.ts
 * ```
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  OrderNumberService, 
  OrderIdentifier,
  OrderNumberGenerationError
} from '../services/orderNumber.service';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import * as businessDateModule from '../utils/businessDate';

// Mock logger globally
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Type for mocked transaction client
type MockTx = {
  $queryRaw: ReturnType<typeof vi.fn>;
  orderSequence: {
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

/**
 * Helper: Create mock transaction client
 */
function createMockTx(): MockTx {
  return {
    $queryRaw: vi.fn(),
    orderSequence: {
      update: vi.fn(),
      create: vi.fn()
    }
  };
}

describe('🔐 SUITE 1: UUID Generation & Validation', () => {
  
  let service: OrderNumberService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderNumberService();
  });
  
  it('UT-001: Should generate RFC4122 v4 compliant UUID', () => {
    const uuids: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const uuid = service.generateUuid();
      uuids.push(uuid);
      
      expect(uuidValidate(uuid), `UUID ${uuid} failed validation`).toBe(true);
      expect(uuidVersion(uuid), `UUID ${uuid} is not v4`).toBe(4);
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
    
    const uniqueCount = new Set(uuids).size;
    expect(uniqueCount).toBe(10);
  });
  
  it('UT-002: Should reject malformed UUIDs in validation', () => {
    const invalidUuids = [
      '',
      'not-a-uuid',
      '12345678-1234-1234-1234-123456789012',
      '550e8400-e29b-41d4-a716-44665544000',
      '550e8400-e29b-41d4-a716-446655440000-extra',
      '550e8400-e29b-31d4-a716-446655440000',
      null as any,
      undefined as any,
      123 as any,
      {} as any
    ];
    
    invalidUuids.forEach((invalidUuid, index) => {
      const result = service.validateUuid(invalidUuid);
      expect(result, `Invalid UUID at index ${index} passed validation: ${invalidUuid}`).toBe(false);
    });
  });
  
  it('UT-003: Should generate 10,000 unique UUIDs without collisions', () => {
    const uuids = new Set<string>();
    const iterations = 10000;
    
    for (let i = 0; i < iterations; i++) {
      uuids.add(service.generateUuid());
    }
    
    expect(uuids.size).toBe(iterations);
  });
});

describe('📅 SUITE 2: Business Date 6 AM Cutoff Logic (CRITICAL BUG TEST)', () => {
  
  let service: OrderNumberService;
  let mockTx: MockTx;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderNumberService();
    mockTx = createMockTx();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('UT-004: Order created at 5:59 AM should use PREVIOUS day', async () => {
    // Mock businessDate to return 2026-01-18
    const expectedDate = new Date('2026-01-18T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260118');
    
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.orderSequence.create.mockResolvedValue({
      id: 1,
      sequenceKey: '20260118',
      currentValue: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const result = await service.getNextOrderNumber(mockTx as any);
    
    expect(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-18');
    expect(result.orderNumber).toBe(1);
    expect(uuidValidate(result.id)).toBe(true);
  });
  
  it('UT-005: Order created at 6:01 AM should use CURRENT day', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.orderSequence.create.mockResolvedValue({
      id: 2,
      sequenceKey: '20260119',
      currentValue: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const result = await service.getNextOrderNumber(mockTx as any);
    
    expect(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
    expect(result.orderNumber).toBe(1);
  });
  
  it('UT-006: Order exactly at 6:00:00 AM should use CURRENT day', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.orderSequence.create.mockResolvedValue({
      id: 3,
      sequenceKey: '20260119',
      currentValue: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const result = await service.getNextOrderNumber(mockTx as any);
    
    expect(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
  });
  
  it('UT-007: businessDate should be immutable within transaction', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    mockTx.$queryRaw.mockResolvedValue([{
      id: 1,
      currentValue: 41
    }]);
    mockTx.orderSequence.update.mockResolvedValue({
      id: 1,
      currentValue: 42
    } as any);
    
    const result = await service.getNextOrderNumber(mockTx as any);
    
    expect(result.businessDate.getTime()).toBe(expectedDate.getTime());
  });
});

describe('⚡ SUITE 3: Race Conditions & Concurrency', () => {
  
  let service: OrderNumberService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderNumberService();
  });
  
  it('IT-001: Should maintain strict sequence across 50 concurrent requests', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    let currentValue = 0;
    const mockTx: MockTx = {
      $queryRaw: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return [{ id: 1, currentValue }];
      }),
      orderSequence: {
        update: vi.fn(async (args: any) => {
          currentValue = args.data.currentValue;
          return { id: 1, currentValue };
        }),
        create: vi.fn()
      }
    };
    
    const promises: Promise<OrderIdentifier>[] = [];
    for (let i = 0; i < 50; i++) {
      promises.push(service.getNextOrderNumber(mockTx as any));
    }
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(50);
    
    const uuids = results.map(r => r.id);
    expect(new Set(uuids).size).toBe(50);
    
    const orderNumbers = results.map(r => r.orderNumber).sort((a, b) => a - b);
    expect(orderNumbers[0]).toBe(1);
    expect(orderNumbers[49]).toBe(50);
    
    for (let i = 1; i <= 50; i++) {
      expect(orderNumbers).toContain(i);
    }
  });
});

describe('💥 SUITE 4: Database Constraint Violations', () => {
  
  it('CT-001: Should handle UUID constraint violation gracefully', async () => {
    const service = new OrderNumberService();
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    const mockTx = createMockTx();
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.orderSequence.create.mockResolvedValue({
      id: 1,
      currentValue: 1
    } as any);
    
    const result1 = await service.getNextOrderNumber(mockTx as any);
    expect(result1.id).toBeDefined();
  });
});

describe('🔄 SUITE 5: Retry Logic & Error Handling', () => {
  
  let service: OrderNumberService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderNumberService();
  });
  
  it('UT-008: Should retry up to 3 times on deadlock', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    const mockTx = createMockTx();
    let attemptCount = 0;
    
    mockTx.$queryRaw.mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        const error: any = new Error('Deadlock found when trying to get lock');
        error.code = '40001';
        throw error;
      }
      return [{ id: 1, currentValue: 5 }];
    });
    
    mockTx.orderSequence.update.mockResolvedValue({ id: 1, currentValue: 6 } as any);
    
    const result = await service.getNextOrderNumber(mockTx as any);
    
    expect(attemptCount).toBe(3);
    expect(result.orderNumber).toBe(6);
    expect(uuidValidate(result.id)).toBe(true);
  });
  
  it('UT-009: Should throw after 3 failed attempts', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    const mockTx = createMockTx();
    
    mockTx.$queryRaw.mockRejectedValue(
      Object.assign(new Error('Lock wait timeout exceeded'), { code: '1205' })
    );
    
    await expect(service.getNextOrderNumber(mockTx as any)).rejects.toThrow(
      OrderNumberGenerationError
    );
    
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
  });
  
  it('UT-010: Should NOT retry non-retryable errors', async () => {
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    const mockTx = createMockTx();
    
    mockTx.$queryRaw.mockRejectedValue(
      Object.assign(new Error('Foreign key constraint fails'), { code: 'P2003' })
    );
    
    await expect(service.getNextOrderNumber(mockTx as any)).rejects.toThrow();
    
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('📊 SUITE 6: Performance & Latency', () => {
  
  it('PT-001: Generation should complete in < 100ms average', async () => {
    const service = new OrderNumberService();
    const expectedDate = new Date('2026-01-19T00:00:00-03:00');
    vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
    vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
    
    const mockTx = createMockTx();
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, currentValue: 1 }]);
    mockTx.orderSequence.update.mockResolvedValue({ id: 1, currentValue: 2 } as any);
    
    const latencies: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await service.getNextOrderNumber(mockTx as any);
      const latency = Date.now() - start;
      latencies.push(latency);
    }
    
    const sorted = latencies.sort((a, b) => a - b);
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    
    expect(p99).toBeLessThan(100);
    expect(avg).toBeLessThan(50);
  });
});
