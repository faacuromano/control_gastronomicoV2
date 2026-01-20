"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const orderNumber_service_1 = require("../services/orderNumber.service");
const uuid_1 = require("uuid");
const businessDateModule = __importStar(require("../utils/businessDate"));
// Mock logger globally
vitest_1.vi.mock('../utils/logger', () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
        debug: vitest_1.vi.fn()
    }
}));
/**
 * Helper: Create mock transaction client
 */
function createMockTx() {
    return {
        $queryRaw: vitest_1.vi.fn(),
        orderSequence: {
            update: vitest_1.vi.fn(),
            create: vitest_1.vi.fn()
        }
    };
}
(0, vitest_1.describe)('🔐 SUITE 1: UUID Generation & Validation', () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new orderNumber_service_1.OrderNumberService();
    });
    (0, vitest_1.it)('UT-001: Should generate RFC4122 v4 compliant UUID', () => {
        const uuids = [];
        for (let i = 0; i < 10; i++) {
            const uuid = service.generateUuid();
            uuids.push(uuid);
            (0, vitest_1.expect)((0, uuid_1.validate)(uuid), `UUID ${uuid} failed validation`).toBe(true);
            (0, vitest_1.expect)((0, uuid_1.version)(uuid), `UUID ${uuid} is not v4`).toBe(4);
            (0, vitest_1.expect)(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        }
        const uniqueCount = new Set(uuids).size;
        (0, vitest_1.expect)(uniqueCount).toBe(10);
    });
    (0, vitest_1.it)('UT-002: Should reject malformed UUIDs in validation', () => {
        const invalidUuids = [
            '',
            'not-a-uuid',
            '12345678-1234-1234-1234-123456789012',
            '550e8400-e29b-41d4-a716-44665544000',
            '550e8400-e29b-41d4-a716-446655440000-extra',
            '550e8400-e29b-31d4-a716-446655440000',
            null,
            undefined,
            123,
            {}
        ];
        invalidUuids.forEach((invalidUuid, index) => {
            const result = service.validateUuid(invalidUuid);
            (0, vitest_1.expect)(result, `Invalid UUID at index ${index} passed validation: ${invalidUuid}`).toBe(false);
        });
    });
    (0, vitest_1.it)('UT-003: Should generate 10,000 unique UUIDs without collisions', () => {
        const uuids = new Set();
        const iterations = 10000;
        for (let i = 0; i < iterations; i++) {
            uuids.add(service.generateUuid());
        }
        (0, vitest_1.expect)(uuids.size).toBe(iterations);
    });
});
(0, vitest_1.describe)('📅 SUITE 2: Business Date 6 AM Cutoff Logic (CRITICAL BUG TEST)', () => {
    let service;
    let mockTx;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new orderNumber_service_1.OrderNumberService();
        mockTx = createMockTx();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('UT-004: Order created at 5:59 AM should use PREVIOUS day', async () => {
        // Mock businessDate to return 2026-01-18
        const expectedDate = new Date('2026-01-18T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260118');
        mockTx.$queryRaw.mockResolvedValue([]);
        mockTx.orderSequence.create.mockResolvedValue({
            id: 1,
            sequenceKey: '20260118',
            currentValue: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const result = await service.getNextOrderNumber(mockTx);
        (0, vitest_1.expect)(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-18');
        (0, vitest_1.expect)(result.orderNumber).toBe(1);
        (0, vitest_1.expect)((0, uuid_1.validate)(result.id)).toBe(true);
    });
    (0, vitest_1.it)('UT-005: Order created at 6:01 AM should use CURRENT day', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        mockTx.$queryRaw.mockResolvedValue([]);
        mockTx.orderSequence.create.mockResolvedValue({
            id: 2,
            sequenceKey: '20260119',
            currentValue: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const result = await service.getNextOrderNumber(mockTx);
        (0, vitest_1.expect)(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
        (0, vitest_1.expect)(result.orderNumber).toBe(1);
    });
    (0, vitest_1.it)('UT-006: Order exactly at 6:00:00 AM should use CURRENT day', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        mockTx.$queryRaw.mockResolvedValue([]);
        mockTx.orderSequence.create.mockResolvedValue({
            id: 3,
            sequenceKey: '20260119',
            currentValue: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const result = await service.getNextOrderNumber(mockTx);
        (0, vitest_1.expect)(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
    });
    (0, vitest_1.it)('UT-007: businessDate should be immutable within transaction', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        mockTx.$queryRaw.mockResolvedValue([{
                id: 1,
                currentValue: 41
            }]);
        mockTx.orderSequence.update.mockResolvedValue({
            id: 1,
            currentValue: 42
        });
        const result = await service.getNextOrderNumber(mockTx);
        (0, vitest_1.expect)(result.businessDate.getTime()).toBe(expectedDate.getTime());
    });
});
(0, vitest_1.describe)('⚡ SUITE 3: Race Conditions & Concurrency', () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new orderNumber_service_1.OrderNumberService();
    });
    (0, vitest_1.it)('IT-001: Should maintain strict sequence across 50 concurrent requests', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        let currentValue = 0;
        const mockTx = {
            $queryRaw: vitest_1.vi.fn(async () => {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                return [{ id: 1, currentValue }];
            }),
            orderSequence: {
                update: vitest_1.vi.fn(async (args) => {
                    currentValue = args.data.currentValue;
                    return { id: 1, currentValue };
                }),
                create: vitest_1.vi.fn()
            }
        };
        const promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(service.getNextOrderNumber(mockTx));
        }
        const results = await Promise.all(promises);
        (0, vitest_1.expect)(results).toHaveLength(50);
        const uuids = results.map(r => r.id);
        (0, vitest_1.expect)(new Set(uuids).size).toBe(50);
        const orderNumbers = results.map(r => r.orderNumber).sort((a, b) => a - b);
        (0, vitest_1.expect)(orderNumbers[0]).toBe(1);
        (0, vitest_1.expect)(orderNumbers[49]).toBe(50);
        for (let i = 1; i <= 50; i++) {
            (0, vitest_1.expect)(orderNumbers).toContain(i);
        }
    });
});
(0, vitest_1.describe)('💥 SUITE 4: Database Constraint Violations', () => {
    (0, vitest_1.it)('CT-001: Should handle UUID constraint violation gracefully', async () => {
        const service = new orderNumber_service_1.OrderNumberService();
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        const mockTx = createMockTx();
        mockTx.$queryRaw.mockResolvedValue([]);
        mockTx.orderSequence.create.mockResolvedValue({
            id: 1,
            currentValue: 1
        });
        const result1 = await service.getNextOrderNumber(mockTx);
        (0, vitest_1.expect)(result1.id).toBeDefined();
    });
});
(0, vitest_1.describe)('🔄 SUITE 5: Retry Logic & Error Handling', () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new orderNumber_service_1.OrderNumberService();
    });
    (0, vitest_1.it)('UT-008: Should retry up to 3 times on deadlock', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        const mockTx = createMockTx();
        let attemptCount = 0;
        mockTx.$queryRaw.mockImplementation(async () => {
            attemptCount++;
            if (attemptCount < 3) {
                const error = new Error('Deadlock found when trying to get lock');
                error.code = '40001';
                throw error;
            }
            return [{ id: 1, currentValue: 5 }];
        });
        mockTx.orderSequence.update.mockResolvedValue({ id: 1, currentValue: 6 });
        const result = await service.getNextOrderNumber(mockTx);
        (0, vitest_1.expect)(attemptCount).toBe(3);
        (0, vitest_1.expect)(result.orderNumber).toBe(6);
        (0, vitest_1.expect)((0, uuid_1.validate)(result.id)).toBe(true);
    });
    (0, vitest_1.it)('UT-009: Should throw after 3 failed attempts', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        const mockTx = createMockTx();
        mockTx.$queryRaw.mockRejectedValue(Object.assign(new Error('Lock wait timeout exceeded'), { code: '1205' }));
        await (0, vitest_1.expect)(service.getNextOrderNumber(mockTx)).rejects.toThrow(orderNumber_service_1.OrderNumberGenerationError);
        (0, vitest_1.expect)(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
    });
    (0, vitest_1.it)('UT-010: Should NOT retry non-retryable errors', async () => {
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        const mockTx = createMockTx();
        mockTx.$queryRaw.mockRejectedValue(Object.assign(new Error('Foreign key constraint fails'), { code: 'P2003' }));
        await (0, vitest_1.expect)(service.getNextOrderNumber(mockTx)).rejects.toThrow();
        (0, vitest_1.expect)(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    });
});
(0, vitest_1.describe)('📊 SUITE 6: Performance & Latency', () => {
    (0, vitest_1.it)('PT-001: Generation should complete in < 100ms average', async () => {
        const service = new orderNumber_service_1.OrderNumberService();
        const expectedDate = new Date('2026-01-19T00:00:00-03:00');
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDate').mockReturnValue(expectedDate);
        vitest_1.vi.spyOn(businessDateModule, 'getBusinessDateKey').mockReturnValue('20260119');
        const mockTx = createMockTx();
        mockTx.$queryRaw.mockResolvedValue([{ id: 1, currentValue: 1 }]);
        mockTx.orderSequence.update.mockResolvedValue({ id: 1, currentValue: 2 });
        const latencies = [];
        for (let i = 0; i < 100; i++) {
            const start = Date.now();
            await service.getNextOrderNumber(mockTx);
            const latency = Date.now() - start;
            latencies.push(latency);
        }
        const sorted = latencies.sort((a, b) => a - b);
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        (0, vitest_1.expect)(p99).toBeLessThan(100);
        (0, vitest_1.expect)(avg).toBeLessThan(50);
    });
});
//# sourceMappingURL=orderNumber.forensic.spec.js.map