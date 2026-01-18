/**
 * Discount Service
 * Frontend service for manual discounts
 */

import api from '../lib/api';

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type DiscountReason = 
    | 'EMPLOYEE' 
    | 'VIP_CUSTOMER' 
    | 'PROMOTION' 
    | 'COMPLAINT' 
    | 'MANAGER_COURTESY' 
    | 'LOYALTY' 
    | 'OTHER';

export interface DiscountReasonOption {
    code: DiscountReason;
    label: string;
}

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
 * Calculate discount amount for preview
 */
export function calculateDiscountPreview(
    subtotal: number,
    type: DiscountType,
    value: number
): number {
    if (type === 'PERCENTAGE') {
        return subtotal * (value / 100);
    }
    return Math.min(value, subtotal);
}

class DiscountService {
    async applyDiscount(input: ApplyDiscountInput): Promise<DiscountResult> {
        const response = await api.post('/discounts/apply', input);
        return response.data.data;
    }

    async removeDiscount(orderId: number): Promise<DiscountResult> {
        const response = await api.delete(`/discounts/${orderId}`);
        return response.data.data;
    }

    async getDiscountReasons(): Promise<DiscountReasonOption[]> {
        const response = await api.get('/discounts/reasons');
        return response.data.data;
    }
}

export const discountService = new DiscountService();
