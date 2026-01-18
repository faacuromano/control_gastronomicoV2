/**
 * @fileoverview Payment processing service extracted from OrderService.
 * Handles payment creation, validation, and status calculation.
 *
 * @module services/payment.service
 * @adheres Single Responsibility Principle - Only handles payment operations
 */
import { PaymentMethod, PaymentStatus } from '@prisma/client';
/**
 * Input for creating a single payment.
 */
export interface PaymentInput {
    method: PaymentMethod;
    amount: number;
}
/**
 * Result of payment processing with calculated status.
 */
export interface PaymentProcessingResult {
    /** Payment records ready to be created with order */
    paymentsToCreate: {
        amount: number;
        method: PaymentMethod;
        shiftId: number;
    }[];
    /** Calculated payment status based on total paid */
    paymentStatus: PaymentStatus;
    /** Whether order is fully paid */
    isFullyPaid: boolean;
    /** Total amount paid */
    totalPaid: number;
}
/**
 * Service for processing and validating payments.
 * Extracted from OrderService to comply with Single Responsibility Principle.
 */
export declare class PaymentService {
    /**
     * Process payment inputs and calculate final status.
     * Supports both legacy single payment and split payments.
     *
     * @param orderTotal - The total amount due for the order
     * @param shiftId - The active cash shift ID for payment attribution
     * @param singlePaymentMethod - Legacy: single payment method (optional)
     * @param splitPayments - Array of split payments (optional)
     * @returns Processed payment data ready for order creation
     *
     * @example
     * // Single payment
     * const result = paymentService.processPayments(100, 1, 'CASH', undefined);
     *
     * // Split payment
     * const result = paymentService.processPayments(100, 1, undefined, [
     *   { method: 'CASH', amount: 50 },
     *   { method: 'CARD', amount: 50 }
     * ]);
     */
    processPayments(orderTotal: number, shiftId: number, singlePaymentMethod?: PaymentMethod, splitPayments?: PaymentInput[]): PaymentProcessingResult;
    /**
     * Validate that payment amounts are reasonable.
     *
     * @param payments - Array of payments to validate
     * @param orderTotal - The order total to compare against
     * @throws Error if payments exceed order total significantly
     */
    validatePaymentAmounts(payments: PaymentInput[], orderTotal: number): void;
}
export declare const paymentService: PaymentService;
//# sourceMappingURL=payment.service.d.ts.map