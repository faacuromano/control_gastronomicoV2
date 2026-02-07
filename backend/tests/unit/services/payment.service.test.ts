/**
 * Unit tests for PaymentService
 * Tests: processPayments (single/split), validatePaymentAmounts, status transitions
 */

// --- Mocks ---

jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Imports after mocks ---

import { PaymentService } from '../../../src/services/payment.service';

const service = new PaymentService();

describe('PaymentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== processPayments ====================

    describe('processPayments', () => {
        describe('Single payment (legacy)', () => {
            it('creates a single payment for the full order total', () => {
                const result = service.processPayments(10000, 1, 'CASH', undefined);

                expect(result.paymentsToCreate).toHaveLength(1);
                expect(result.paymentsToCreate[0]).toEqual({
                    amount: 10000,
                    method: 'CASH',
                    shiftId: 1,
                });
                expect(result.paymentStatus).toBe('PAID');
                expect(result.isFullyPaid).toBe(true);
                expect(result.totalPaid).toBe(10000);
            });

            it('handles CARD payment method', () => {
                const result = service.processPayments(5000, 2, 'CARD', undefined);

                expect(result.paymentsToCreate[0]!.method).toBe('CARD');
                expect(result.paymentStatus).toBe('PAID');
            });

            it('handles null shiftId', () => {
                const result = service.processPayments(1000, null, 'CASH', undefined);

                expect(result.paymentsToCreate[0]!.shiftId).toBeNull();
            });
        });

        describe('Split payments', () => {
            it('creates multiple payments that sum to order total', () => {
                const result = service.processPayments(10000, 1, undefined, [
                    { method: 'CASH' as any, amount: 6000 },
                    { method: 'CARD' as any, amount: 4000 },
                ]);

                expect(result.paymentsToCreate).toHaveLength(2);
                expect(result.totalPaid).toBe(10000);
                expect(result.paymentStatus).toBe('PAID');
                expect(result.isFullyPaid).toBe(true);
            });

            it('detects partial payment', () => {
                const result = service.processPayments(10000, 1, undefined, [
                    { method: 'CASH' as any, amount: 3000 },
                ]);

                expect(result.totalPaid).toBe(3000);
                expect(result.paymentStatus).toBe('PARTIAL');
                expect(result.isFullyPaid).toBe(false);
            });

            it('allows slight overpayment (within 10%)', () => {
                const result = service.processPayments(10000, 1, undefined, [
                    { method: 'CASH' as any, amount: 10500 },
                ]);

                expect(result.totalPaid).toBe(10500);
                expect(result.paymentStatus).toBe('PAID');
                expect(result.isFullyPaid).toBe(true);
            });

            it('rejects negative payment amounts', () => {
                expect(() =>
                    service.processPayments(10000, 1, undefined, [
                        { method: 'CASH' as any, amount: -500 },
                    ])
                ).toThrow('Invalid payment amount');
            });

            it('rejects zero payment amounts', () => {
                expect(() =>
                    service.processPayments(10000, 1, undefined, [
                        { method: 'CASH' as any, amount: 0 },
                    ])
                ).toThrow('Invalid payment amount');
            });

            it('rejects excessive overpayment (>10%)', () => {
                expect(() =>
                    service.processPayments(10000, 1, undefined, [
                        { method: 'CASH' as any, amount: 15000 },
                    ])
                ).toThrow(/exceeds order total/);
            });
        });

        describe('No payment', () => {
            it('returns PENDING when no payment method or splits provided', () => {
                const result = service.processPayments(10000, 1, undefined, undefined);

                expect(result.paymentsToCreate).toHaveLength(0);
                expect(result.paymentStatus).toBe('PENDING');
                expect(result.isFullyPaid).toBe(false);
                expect(result.totalPaid).toBe(0);
            });

            it('returns PENDING with empty splits array', () => {
                const result = service.processPayments(10000, 1, undefined, []);

                expect(result.paymentsToCreate).toHaveLength(0);
                expect(result.paymentStatus).toBe('PENDING');
            });
        });

        describe('Split payments prefer over single when both provided', () => {
            it('ignores single method when splits are given', () => {
                const result = service.processPayments(10000, 1, 'CASH' as any, [
                    { method: 'CARD' as any, amount: 10000 },
                ]);

                // The guard `singlePaymentMethod && !splitPayments` skips single when splits exist
                expect(result.paymentsToCreate).toHaveLength(1);
                expect(result.paymentsToCreate[0]!.method).toBe('CARD');
                expect(result.totalPaid).toBe(10000);
            });
        });
    });

    // ==================== validatePaymentAmounts ====================

    describe('validatePaymentAmounts', () => {
        it('accepts payments equal to order total', () => {
            expect(() =>
                service.validatePaymentAmounts(
                    [{ method: 'CASH' as any, amount: 5000 }],
                    5000
                )
            ).not.toThrow();
        });

        it('accepts slight overpayment (up to 10%)', () => {
            expect(() =>
                service.validatePaymentAmounts(
                    [{ method: 'CASH' as any, amount: 5500 }],
                    5000
                )
            ).not.toThrow();
        });

        it('accepts payments at exactly 10% over', () => {
            expect(() =>
                service.validatePaymentAmounts(
                    [{ method: 'CASH' as any, amount: 5500 }],
                    5000
                )
            ).not.toThrow();
        });

        it('rejects payments exceeding 10% of total', () => {
            expect(() =>
                service.validatePaymentAmounts(
                    [{ method: 'CASH' as any, amount: 6000 }],
                    5000
                )
            ).toThrow(/exceeds order total/);
        });

        it('validates sum of multiple payments', () => {
            expect(() =>
                service.validatePaymentAmounts(
                    [
                        { method: 'CASH' as any, amount: 3000 },
                        { method: 'CARD' as any, amount: 3500 },
                    ],
                    5000
                )
            ).toThrow(/exceeds order total/);
        });

        it('accepts underpayment (partial)', () => {
            expect(() =>
                service.validatePaymentAmounts(
                    [{ method: 'CASH' as any, amount: 2000 }],
                    5000
                )
            ).not.toThrow();
        });
    });

    // ==================== Payment Status Transitions ====================

    describe('Payment status determination', () => {
        it('PENDING: no payments made', () => {
            const result = service.processPayments(5000, 1);
            expect(result.paymentStatus).toBe('PENDING');
        });

        it('PARTIAL: some but not all paid', () => {
            const result = service.processPayments(10000, 1, undefined, [
                { method: 'CASH' as any, amount: 5000 },
            ]);
            expect(result.paymentStatus).toBe('PARTIAL');
        });

        it('PAID: exact amount', () => {
            const result = service.processPayments(10000, 1, 'CASH' as any);
            expect(result.paymentStatus).toBe('PAID');
        });

        it('PAID: overpayment (within tolerance)', () => {
            const result = service.processPayments(10000, 1, undefined, [
                { method: 'CASH' as any, amount: 10100 },
            ]);
            expect(result.paymentStatus).toBe('PAID');
            expect(result.isFullyPaid).toBe(true);
        });
    });
});
