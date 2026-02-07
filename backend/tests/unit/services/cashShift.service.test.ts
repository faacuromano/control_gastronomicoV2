/**
 * Unit tests for CashShiftService
 * Tests: openShift, closeShift, closeShiftWithCount, calculateExpectedCash,
 *        getShiftReport, getCurrentShift, getShiftHistory, getAll
 */

// --- Mocks MUST come before imports ---

const mockCashShift = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockTable = {
    count: jest.fn(),
};

const mockPayment = {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
    prisma: {
        cashShift: mockCashShift,
        table: mockTable,
        payment: mockPayment,
        $transaction: (...args: any[]) => mockTransaction(...args),
    },
}));

jest.mock('../../../src/utils/businessDate', () => ({
    getBusinessDate: jest.fn().mockReturnValue(new Date('2026-02-07')),
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Imports after mocks ---

import { CashShiftService } from '../../../src/services/cashShift.service';

const service = new CashShiftService();
const TENANT_ID = 1;
const USER_ID = 10;

const createMockShift = (overrides = {}) => ({
    id: 1,
    tenantId: TENANT_ID,
    userId: USER_ID,
    startAmount: 5000,
    endAmount: null,
    startTime: new Date('2026-02-07T08:00:00'),
    endTime: null,
    businessDate: new Date('2026-02-07'),
    user: { name: 'Test Cashier' },
    payments: [],
    ...overrides,
});

describe('CashShiftService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- openShift ---

    describe('openShift', () => {
        it('creates a new shift when no open shift exists', async () => {
            const newShift = createMockShift();
            const txMock = {
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue(newShift),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.openShift(TENANT_ID, USER_ID, 5000);

            expect(result).toEqual(newShift);
            expect(txMock.cashShift.findFirst).toHaveBeenCalledWith({
                where: { userId: USER_ID, tenantId: TENANT_ID, endTime: null },
            });
            expect(txMock.cashShift.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId: TENANT_ID,
                        userId: USER_ID,
                        startAmount: 5000,
                    }),
                })
            );
        });

        it('throws ConflictError when user already has an open shift', async () => {
            const txMock = {
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(createMockShift()),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(service.openShift(TENANT_ID, USER_ID, 5000)).rejects.toThrow(
                'User already has an open shift'
            );
        });
    });

    // --- closeShift ---

    describe('closeShift', () => {
        it('closes an open shift when no tables are occupied', async () => {
            const closedShift = createMockShift({ endTime: new Date(), endAmount: 12000 });
            const txMock = {
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(createMockShift()),
                    update: jest.fn().mockResolvedValue(closedShift),
                },
                table: {
                    count: jest.fn().mockResolvedValue(0),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            const result = await service.closeShift(TENANT_ID, USER_ID, 12000);

            expect(result).toEqual(closedShift);
            expect(txMock.cashShift.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: expect.objectContaining({ endAmount: 12000 }),
                })
            );
        });

        it('throws NotFoundError when no open shift exists', async () => {
            const txMock = {
                cashShift: { findFirst: jest.fn().mockResolvedValue(null) },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(service.closeShift(TENANT_ID, USER_ID, 12000)).rejects.toThrow(
                'No open shift found for this user'
            );
        });

        it('throws ConflictError when tables are occupied', async () => {
            const txMock = {
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(createMockShift()),
                },
                table: {
                    count: jest.fn().mockResolvedValue(3),
                },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            await expect(service.closeShift(TENANT_ID, USER_ID, 12000)).rejects.toThrow(
                /occupied tables/
            );
        });
    });

    // --- closeShiftWithCount ---

    describe('closeShiftWithCount', () => {
        it('closes shift and returns report', async () => {
            const txMock = {
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(createMockShift()),
                    update: jest.fn().mockResolvedValue(createMockShift({ id: 1, endTime: new Date(), endAmount: 11000 })),
                },
                table: { count: jest.fn().mockResolvedValue(0) },
            };
            mockTransaction.mockImplementation(async (fn: any) => fn(txMock));

            // Mock getShiftReport dependencies (called outside transaction)
            mockCashShift.findFirst.mockResolvedValue(
                createMockShift({
                    endTime: new Date(),
                    endAmount: 11000,
                    user: { name: 'Test Cashier' },
                    payments: [{ orderId: 1, amount: 6000, method: 'CASH' }],
                })
            );
            mockPayment.groupBy.mockResolvedValue([
                { method: 'CASH', _sum: { amount: 6000 }, _count: 1 },
            ]);

            const result = await service.closeShiftWithCount(TENANT_ID, USER_ID, 11000);

            expect(result).toHaveProperty('shift');
            expect(result).toHaveProperty('sales');
            expect(result).toHaveProperty('cash');
            expect(result.shift.userName).toBe('Test Cashier');
        });
    });

    // --- calculateExpectedCash ---

    describe('calculateExpectedCash', () => {
        it('returns startAmount + cash sales', async () => {
            mockCashShift.findFirst.mockResolvedValue(createMockShift({ startAmount: 5000 }));
            mockPayment.aggregate.mockResolvedValue({ _sum: { amount: 8000 } });

            const result = await service.calculateExpectedCash(1, TENANT_ID);

            expect(result).toBe(13000);
            expect(mockPayment.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { shiftId: 1, tenantId: TENANT_ID, method: 'CASH' },
                })
            );
        });

        it('returns startAmount when no cash payments', async () => {
            mockCashShift.findFirst.mockResolvedValue(createMockShift({ startAmount: 5000 }));
            mockPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

            const result = await service.calculateExpectedCash(1, TENANT_ID);

            expect(result).toBe(5000);
        });

        it('throws NotFoundError for missing shift', async () => {
            mockCashShift.findFirst.mockResolvedValue(null);

            await expect(service.calculateExpectedCash(999, TENANT_ID)).rejects.toThrow(
                'Shift not found'
            );
        });
    });

    // --- getShiftReport ---

    describe('getShiftReport', () => {
        it('returns complete report with cash reconciliation', async () => {
            mockCashShift.findFirst.mockResolvedValue(
                createMockShift({
                    endTime: new Date(),
                    endAmount: 14000,
                    user: { name: 'Maria' },
                    payments: [
                        { orderId: 1, amount: 5000, method: 'CASH' },
                        { orderId: 2, amount: 3000, method: 'CASH' },
                        { orderId: 3, amount: 2000, method: 'CARD' },
                    ],
                })
            );
            mockPayment.groupBy.mockResolvedValue([
                { method: 'CASH', _sum: { amount: 8000 }, _count: 2 },
                { method: 'CARD', _sum: { amount: 2000 }, _count: 1 },
            ]);

            const report = await service.getShiftReport(1, TENANT_ID);

            expect(report.shift.userName).toBe('Maria');
            expect(report.sales.totalOrders).toBe(3);
            expect(report.sales.totalSales).toBe(10000);
            expect(report.sales.byPaymentMethod).toHaveLength(2);
            expect(report.cash.startAmount).toBe(5000);
            expect(report.cash.cashSales).toBe(8000);
            expect(report.cash.expectedCash).toBe(13000);
            expect(report.cash.countedCash).toBe(14000);
            expect(report.cash.difference).toBe(1000);
        });

        it('throws NotFoundError for missing shift', async () => {
            mockCashShift.findFirst.mockResolvedValue(null);
            await expect(service.getShiftReport(999, TENANT_ID)).rejects.toThrow('Shift not found');
        });
    });

    // --- getCurrentShift ---

    describe('getCurrentShift', () => {
        it('returns open shift for user', async () => {
            const shift = createMockShift();
            mockCashShift.findFirst.mockResolvedValue(shift);

            const result = await service.getCurrentShift(TENANT_ID, USER_ID);

            expect(result).toEqual(shift);
            expect(mockCashShift.findFirst).toHaveBeenCalledWith({
                where: { userId: USER_ID, tenantId: TENANT_ID, endTime: null },
                include: { user: { select: { name: true, email: true } } },
            });
        });

        it('returns null when no open shift', async () => {
            mockCashShift.findFirst.mockResolvedValue(null);

            const result = await service.getCurrentShift(TENANT_ID, USER_ID);

            expect(result).toBeNull();
        });
    });

    // --- getShiftHistory ---

    describe('getShiftHistory', () => {
        it('returns shift history for user with default limit', async () => {
            const shifts = [createMockShift(), createMockShift({ id: 2 })];
            mockCashShift.findMany.mockResolvedValue(shifts);

            const result = await service.getShiftHistory(USER_ID, TENANT_ID);

            expect(result).toHaveLength(2);
            expect(mockCashShift.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: USER_ID, tenantId: TENANT_ID },
                    orderBy: { startTime: 'desc' },
                    take: 10,
                })
            );
        });

        it('caps limit at 100', async () => {
            mockCashShift.findMany.mockResolvedValue([]);

            await service.getShiftHistory(USER_ID, TENANT_ID, 500);

            expect(mockCashShift.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 100 })
            );
        });
    });

    // --- getAll ---

    describe('getAll', () => {
        it('returns all shifts for tenant', async () => {
            mockCashShift.findMany.mockResolvedValue([createMockShift()]);

            const result = await service.getAll(TENANT_ID);

            expect(result).toHaveLength(1);
            expect(mockCashShift.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { tenantId: TENANT_ID },
                })
            );
        });

        it('filters by date and userId', async () => {
            mockCashShift.findMany.mockResolvedValue([]);

            await service.getAll(TENANT_ID, { fromDate: '2026-02-01', userId: 5 });

            expect(mockCashShift.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        tenantId: TENANT_ID,
                        businessDate: { gte: new Date('2026-02-01') },
                        userId: 5,
                    },
                })
            );
        });
    });
});
