/**
 * @fileoverview Manual discount service.
 * Handles applying discounts to orders with authorization and audit logging.
 *
 * @module services/discount.service
 * @phase2 Operational Features
 */
import { AuditContext } from './audit.service';
/**
 * Discount types supported.
 */
export declare const DISCOUNT_TYPES: readonly ["PERCENTAGE", "FIXED"];
export type DiscountType = typeof DISCOUNT_TYPES[number];
/**
 * Discount reasons/categories.
 */
export declare const DISCOUNT_REASONS: readonly ["EMPLOYEE", "VIP_CUSTOMER", "PROMOTION", "COMPLAINT", "MANAGER_COURTESY", "LOYALTY", "OTHER"];
export type DiscountReason = typeof DISCOUNT_REASONS[number];
export interface ApplyDiscountInput {
    orderId: number;
    type: DiscountType;
    value: number;
    reason: DiscountReason;
    notes?: string;
    authorizerId?: number;
}
export interface DiscountResult {
    success: boolean;
    orderId: number;
    previousTotal: number;
    discountAmount: number;
    newTotal: number;
}
/**
 * Service for managing order discounts.
 */
export declare class DiscountService {
    /**
     * Apply a discount to an order.
     *
     * @param input - Discount parameters
     * @param context - Audit context
     * @returns Discount result with new totals
     */
    applyDiscount(input: ApplyDiscountInput, context: AuditContext): Promise<DiscountResult>;
    /**
     * Remove all discounts from an order.
     */
    removeDiscount(orderId: number, context: AuditContext): Promise<DiscountResult>;
    /**
     * Get discount reasons for UI dropdown.
     */
    getDiscountReasons(): {
        code: DiscountReason;
        label: string;
    }[];
    /**
     * Get discount types for UI dropdown.
     */
    getDiscountTypes(): {
        code: DiscountType;
        label: string;
    }[];
}
export declare const discountService: DiscountService;
//# sourceMappingURL=discount.service.d.ts.map