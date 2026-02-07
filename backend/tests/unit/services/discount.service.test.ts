/**
 * Unit tests for DiscountService
 * Tests: applyDiscount, removeDiscount, getDiscountReasons, getDiscountTypes
 */

// --- Mocks MUST come before imports ---

const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
    prisma: {
        $transaction: (...args: any[]) => mockTransaction(...args),
    },
}));

jest.mock('../../../src/services/audit.service', () => ({
    auditService: {
        log: jest.fn().mockResolvedValue(undefined),
    },
    AuditService: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Imports after mocks ---

import { DiscountService } from '../../../src/services/discount.service';

const service = new DiscountService();
const TENANT_ID = 1;
const AUDIT_CTX = { userId: 10, tenantId: TENANT_ID, ip: '127.0.0.1' };

const createMockOrder = (overrides = {}) => ({
    id: 100,
    tenantId: TENANT_ID,
    subtotal: 10000,
    discount: 0,
    total: 10000,
    paymentStatus: 'PENDING',
    closedAt: null,
    payments: [],
    ...overrides,
});

describe('DiscountService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- applyDiscount ---

    describe('applyDiscount', () => {
        it('applies percentage discount correctly', async () => {
            const order = createMockOrder({ subtotal: 10000, total: 10000, discount: 0 });
            const txMock = {
                $queryRaw: jest.fn(),
                order: {
                    findFirst: jest.fn().mockResolvedValue(order),
                    update: jest.fn().mockResolvedValue(order),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.applyDiscount(
                { orderId: 100, type: 'PERCENTAGE', value: 10, reason: 'PROMOTION' },
                TENANT_ID,
                AUDIT_CTX
            );

            expect(result.success).toBe(true);
            expect(result.discountAmount).toBe(1000); // 10% of 10000
            expect(result.newTotal).toBe(9000);
            expect(result.previousTotal).toBe(10000);
        });

        it('applies fixed discount correctly', async () => {
            const order = createMockOrder({ subtotal: 10000, total: 10000, discount: 0 });
            const txMock = {
                $queryRaw: jest.fn(),
                order: {
                    findFirst: jest.fn().mockResolvedValue(order),
                    update: jest.fn().mockResolvedValue(order),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.applyDiscount(
                { orderId: 100, type: 'FIXED', value: 2500, reason: 'VIP_CUSTOMER' },
                TENANT_ID,
                AUDIT_CTX
            );

            expect(result.success).toBe(true);
            expect(result.discountAmount).toBe(2500);
            expect(result.newTotal).toBe(7500);
        });

        it('caps discount at subtotal (cannot go negative)', async () => {
            const order = createMockOrder({ subtotal: 5000, total: 5000, discount: 0 });
            const txMock = {
                $queryRaw: jest.fn(),
                order: {
                    findFirst: jest.fn().mockResolvedValue(order),
                    update: jest.fn().mockResolvedValue(order),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.applyDiscount(
                { orderId: 100, type: 'FIXED', value: 9999, reason: 'MANAGER_COURTESY' },
                TENANT_ID,
                AUDIT_CTX
            );

            expect(result.newTotal).toBe(0);
            expect(result.discountAmount).toBe(5000); // Capped at subtotal
        });

        it('stacks discount on top of existing discount', async () => {
            const order = createMockOrder({
                subtotal: 10000,
                discount: 1000,
                total: 9000,
            });
            const txMock = {
                $queryRaw: jest.fn(),
                order: {
                    findFirst: jest.fn().mockResolvedValue(order),
                    update: jest.fn().mockResolvedValue(order),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.applyDiscount(
                { orderId: 100, type: 'FIXED', value: 500, reason: 'COMPLAINT' },
                TENANT_ID,
                AUDIT_CTX
            );

            expect(result.discountAmount).toBe(500);
            expect(result.newTotal).toBe(8500); // 10000 - 1000 - 500
        });

        it('marks order as PAID if existing payments cover new total', async () => {
            const order = createMockOrder({
                subtotal: 10000,
                total: 10000,
                discount: 0,
                paymentStatus: 'PARTIAL',
                payments: [{ amount: 8000 }],
            });
            const txMock = {
                $queryRaw: jest.fn(),
                order: {
                    findFirst: jest.fn().mockResolvedValue(order),
                    update: jest.fn().mockResolvedValue(order),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await service.applyDiscount(
                { orderId: 100, type: 'FIXED', value: 3000, reason: 'PROMOTION' },
                TENANT_ID,
                AUDIT_CTX
            );

            // Total becomes 7000, paid is 8000 → PAID
            expect(txMock.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ paymentStatus: 'PAID' }),
                })
            );
        });

        it('throws for invalid discount type', async () => {
            await expect(
                service.applyDiscount(
                    { orderId: 100, type: 'BOGUS' as any, value: 10, reason: 'PROMOTION' },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow(/Invalid discount type/);
        });

        it('throws for invalid reason', async () => {
            await expect(
                service.applyDiscount(
                    { orderId: 100, type: 'PERCENTAGE', value: 10, reason: 'INVALID' as any },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow(/Invalid discount reason/);
        });

        it('throws for zero value', async () => {
            await expect(
                service.applyDiscount(
                    { orderId: 100, type: 'PERCENTAGE', value: 0, reason: 'PROMOTION' },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow(/must be positive/);
        });

        it('throws for negative value', async () => {
            await expect(
                service.applyDiscount(
                    { orderId: 100, type: 'FIXED', value: -500, reason: 'PROMOTION' },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow(/must be positive/);
        });

        it('throws for percentage > 100', async () => {
            await expect(
                service.applyDiscount(
                    { orderId: 100, type: 'PERCENTAGE', value: 150, reason: 'PROMOTION' },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow(/cannot exceed 100/);
        });

        it('throws for paid order', async () => {
            const order = createMockOrder({ paymentStatus: 'PAID' });
            const txMock = {
                $queryRaw: jest.fn(),
                order: { findFirst: jest.fn().mockResolvedValue(order) },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(
                service.applyDiscount(
                    { orderId: 100, type: 'PERCENTAGE', value: 10, reason: 'PROMOTION' },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow(/paid order/);
        });

        it('throws NotFoundError for non-existent order', async () => {
            const txMock = {
                $queryRaw: jest.fn(),
                order: { findFirst: jest.fn().mockResolvedValue(null) },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(
                service.applyDiscount(
                    { orderId: 999, type: 'PERCENTAGE', value: 10, reason: 'PROMOTION' },
                    TENANT_ID,
                    AUDIT_CTX
                )
            ).rejects.toThrow();
        });
    });

    // --- removeDiscount ---

    describe('removeDiscount', () => {
        it('removes discount and restores original total', async () => {
            const order = createMockOrder({
                subtotal: 10000,
                discount: 2000,
                total: 8000,
                payments: [],
            });
            const txMock = {
                $queryRaw: jest.fn(),
                order: {
                    findFirst: jest.fn().mockResolvedValue(order),
                    update: jest.fn().mockResolvedValue(order),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.removeDiscount(100, TENANT_ID, AUDIT_CTX);

            expect(result.success).toBe(true);
            expect(result.discountAmount).toBe(-2000); // Negative = removed
            expect(result.newTotal).toBe(10000); // Restored to subtotal
            expect(txMock.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ discount: 0, total: 10000 }),
                })
            );
        });

        it('throws for paid order', async () => {
            const order = createMockOrder({ paymentStatus: 'PAID' });
            const txMock = {
                $queryRaw: jest.fn(),
                order: { findFirst: jest.fn().mockResolvedValue(order) },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(
                service.removeDiscount(100, TENANT_ID, AUDIT_CTX)
            ).rejects.toThrow(/paid order/);
        });

        it('throws NotFoundError for non-existent order', async () => {
            const txMock = {
                $queryRaw: jest.fn(),
                order: { findFirst: jest.fn().mockResolvedValue(null) },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(
                service.removeDiscount(999, TENANT_ID, AUDIT_CTX)
            ).rejects.toThrow();
        });
    });

    // --- getDiscountReasons ---

    describe('getDiscountReasons', () => {
        it('returns all 7 reason options', () => {
            const reasons = service.getDiscountReasons();

            expect(reasons).toHaveLength(7);
            expect(reasons.map(r => r.code)).toEqual([
                'EMPLOYEE', 'VIP_CUSTOMER', 'PROMOTION', 'COMPLAINT',
                'MANAGER_COURTESY', 'LOYALTY', 'OTHER',
            ]);
        });

        it('each reason has code and label', () => {
            const reasons = service.getDiscountReasons();

            for (const reason of reasons) {
                expect(reason).toHaveProperty('code');
                expect(reason).toHaveProperty('label');
                expect(reason.label.length).toBeGreaterThan(0);
            }
        });
    });

    // --- getDiscountTypes ---

    describe('getDiscountTypes', () => {
        it('returns PERCENTAGE and FIXED types', () => {
            const types = service.getDiscountTypes();

            expect(types).toHaveLength(2);
            expect(types.map(t => t.code)).toEqual(['PERCENTAGE', 'FIXED']);
        });

        it('each type has code and label', () => {
            const types = service.getDiscountTypes();

            for (const type of types) {
                expect(type).toHaveProperty('code');
                expect(type).toHaveProperty('label');
            }
        });
    });
});
