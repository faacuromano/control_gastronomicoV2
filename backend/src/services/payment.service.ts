/**
 * @fileoverview Payment processing service extracted from OrderService.
 * Handles payment creation, validation, and status calculation.
 * 
 * @module services/payment.service
 * @adheres Single Responsibility Principle - Only handles payment operations
 */

import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';

/**
 * Transaction context type for Prisma interactive transactions.
 */
type TransactionClient = Omit<
    Prisma.TransactionClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

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
        shiftId: number | null;
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
export class PaymentService {
    
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
    processPayments(
        orderTotal: number,
        shiftId: number | null,
        singlePaymentMethod?: PaymentMethod,
        splitPayments?: PaymentInput[]
    ): PaymentProcessingResult {
        const paymentsToCreate: PaymentProcessingResult['paymentsToCreate'] = [];

        // 1. Handle single payment (legacy support)
        if (singlePaymentMethod && !splitPayments) {
            paymentsToCreate.push({
                amount: orderTotal,
                method: singlePaymentMethod,
                shiftId
            });
        }

        // 2. Handle split payments
        if (splitPayments && splitPayments.length > 0) {
            for (const payment of splitPayments) {
                if (payment.amount <= 0) {
                    throw new Error(`Invalid payment amount: ${payment.amount}`);
                }
                paymentsToCreate.push({
                    amount: payment.amount,
                    method: payment.method,
                    shiftId
                });
            }
        }

        // 3. Calculate totals and status
        const totalPaid = paymentsToCreate.reduce((sum, p) => sum + p.amount, 0);
        const isFullyPaid = totalPaid >= orderTotal;
        
        let paymentStatus: PaymentStatus = 'PENDING';
        if (isFullyPaid) {
            paymentStatus = 'PAID';
        } else if (totalPaid > 0) {
            paymentStatus = 'PARTIAL';
        }

        return {
            paymentsToCreate,
            paymentStatus,
            isFullyPaid,
            totalPaid
        };
    }

    /**
     * Validate that payment amounts are reasonable.
     * 
     * @param payments - Array of payments to validate
     * @param orderTotal - The order total to compare against
     * @throws Error if payments exceed order total significantly
     */
    validatePaymentAmounts(payments: PaymentInput[], orderTotal: number): void {
        const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
        
        // Allow 10% overpayment for rounding, beyond that throw
        const maxAllowed = orderTotal * 1.1;
        if (totalPayments > maxAllowed) {
            throw new Error(
                `Payment total (${totalPayments}) exceeds order total (${orderTotal}) by more than 10%`
            );
        }
    }
}

export const paymentService = new PaymentService();
