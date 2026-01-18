/**
 * @fileoverview Manual discount service.
 * Handles applying discounts to orders with authorization and audit logging.
 * 
 * @module services/discount.service
 * @phase2 Operational Features
 */

import { prisma } from '../lib/prisma';
import { AuditAction } from '@prisma/client';
import { auditService, AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Discount types supported.
 */
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type DiscountType = typeof DISCOUNT_TYPES[number];

/**
 * Discount reasons/categories.
 */
export const DISCOUNT_REASONS = [
    'EMPLOYEE',
    'VIP_CUSTOMER',
    'PROMOTION',
    'COMPLAINT',
    'MANAGER_COURTESY',
    'LOYALTY',
    'OTHER'
] as const;
export type DiscountReason = typeof DISCOUNT_REASONS[number];

export interface ApplyDiscountInput {
    orderId: number;
    type: DiscountType;
    value: number;       // Percentage (0-100) or fixed amount
    reason: DiscountReason;
    notes?: string;
    authorizerId?: number;  // Manager who authorized (optional for now)
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
export class DiscountService {
    
    /**
     * Apply a discount to an order.
     * 
     * @param input - Discount parameters
     * @param context - Audit context
     * @returns Discount result with new totals
     */
    async applyDiscount(
        input: ApplyDiscountInput,
        context: AuditContext
    ): Promise<DiscountResult> {
        // Validate discount type
        if (!DISCOUNT_TYPES.includes(input.type)) {
            throw new ValidationError(`Invalid discount type: ${input.type}`);
        }
        
        if (!DISCOUNT_REASONS.includes(input.reason)) {
            throw new ValidationError(`Invalid discount reason: ${input.reason}`);
        }
        
        // Validate value
        if (input.value <= 0) {
            throw new ValidationError('Discount value must be positive');
        }
        
        if (input.type === 'PERCENTAGE' && input.value > 100) {
            throw new ValidationError('Percentage discount cannot exceed 100%');
        }
        
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get the order
            const order = await tx.order.findUnique({
                where: { id: input.orderId }
            });
            
            if (!order) {
                throw new NotFoundError('Order');
            }
            
            // 2. Check if order is modifiable
            if (order.paymentStatus === 'PAID') {
                throw new ValidationError('Cannot apply discount to a paid order');
            }
            
            const subtotal = Number(order.subtotal);
            const previousDiscount = Number(order.discount);
            const previousTotal = Number(order.total);
            
            // 3. Calculate discount amount
            let discountAmount: number;
            if (input.type === 'PERCENTAGE') {
                discountAmount = (subtotal * input.value) / 100;
            } else {
                discountAmount = input.value;
            }
            
            // 4. Clamp discount to not exceed subtotal
            if (discountAmount > subtotal) {
                discountAmount = subtotal;
            }
            
            // Add to existing discount
            const totalDiscount = previousDiscount + discountAmount;
            const newTotal = subtotal - totalDiscount;
            
            // 5. Update order
            await tx.order.update({
                where: { id: input.orderId },
                data: {
                    discount: totalDiscount,
                    total: newTotal
                }
            });
            
            return {
                previousTotal,
                discountAmount,
                newTotal,
                totalDiscount
            };
        });
        
        // 6. Log to audit trail
        await auditService.log(
            AuditAction.DISCOUNT_APPLIED,
            'Order',
            input.orderId,
            context,
            {
                type: input.type,
                value: input.value,
                reason: input.reason,
                notes: input.notes,
                authorizerId: input.authorizerId,
                discountAmount: result.discountAmount,
                previousTotal: result.previousTotal,
                newTotal: result.newTotal
            }
        );
        
        logger.info('Discount applied to order', {
            orderId: input.orderId,
            type: input.type,
            value: input.value,
            discountAmount: result.discountAmount,
            reason: input.reason
        });
        
        return {
            success: true,
            orderId: input.orderId,
            previousTotal: result.previousTotal,
            discountAmount: result.discountAmount,
            newTotal: result.newTotal
        };
    }
    
    /**
     * Remove all discounts from an order.
     */
    async removeDiscount(
        orderId: number,
        context: AuditContext
    ): Promise<DiscountResult> {
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId }
            });
            
            if (!order) {
                throw new NotFoundError('Order');
            }
            
            if (order.paymentStatus === 'PAID') {
                throw new ValidationError('Cannot remove discount from a paid order');
            }
            
            const previousDiscount = Number(order.discount);
            const subtotal = Number(order.subtotal);
            const previousTotal = Number(order.total);
            
            await tx.order.update({
                where: { id: orderId },
                data: {
                    discount: 0,
                    total: subtotal
                }
            });
            
            return {
                previousTotal,
                discountRemoved: previousDiscount,
                newTotal: subtotal
            };
        });
        
        // Log removal
        await auditService.log(
            AuditAction.DISCOUNT_APPLIED,
            'Order',
            orderId,
            context,
            {
                action: 'REMOVED',
                discountRemoved: result.discountRemoved,
                newTotal: result.newTotal
            }
        );
        
        logger.info('Discount removed from order', {
            orderId,
            discountRemoved: result.discountRemoved
        });
        
        return {
            success: true,
            orderId,
            previousTotal: result.previousTotal,
            discountAmount: -result.discountRemoved,
            newTotal: result.newTotal
        };
    }
    
    /**
     * Get discount reasons for UI dropdown.
     */
    getDiscountReasons(): { code: DiscountReason; label: string }[] {
        return [
            { code: 'EMPLOYEE', label: 'Descuento empleado' },
            { code: 'VIP_CUSTOMER', label: 'Cliente VIP' },
            { code: 'PROMOTION', label: 'Promoción' },
            { code: 'COMPLAINT', label: 'Queja/Compensación' },
            { code: 'MANAGER_COURTESY', label: 'Cortesía gerente' },
            { code: 'LOYALTY', label: 'Programa de lealtad' },
            { code: 'OTHER', label: 'Otro' }
        ];
    }
    
    /**
     * Get discount types for UI dropdown.
     */
    getDiscountTypes(): { code: DiscountType; label: string }[] {
        return [
            { code: 'PERCENTAGE', label: 'Porcentaje (%)' },
            { code: 'FIXED', label: 'Monto fijo ($)' }
        ];
    }
}

export const discountService = new DiscountService();
