"use strict";
/**
 * @fileoverview Manual discount service.
 * Handles applying discounts to orders with authorization and audit logging.
 *
 * @module services/discount.service
 * @phase2 Operational Features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.discountService = exports.DiscountService = exports.DISCOUNT_REASONS = exports.DISCOUNT_TYPES = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Discount types supported.
 */
exports.DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'];
/**
 * Discount reasons/categories.
 */
exports.DISCOUNT_REASONS = [
    'EMPLOYEE',
    'VIP_CUSTOMER',
    'PROMOTION',
    'COMPLAINT',
    'MANAGER_COURTESY',
    'LOYALTY',
    'OTHER'
];
/**
 * Service for managing order discounts.
 */
class DiscountService {
    /**
     * Apply a discount to an order.
     *
     * @param input - Discount parameters
     * @param context - Audit context
     * @returns Discount result with new totals
     */
    async applyDiscount(input, context) {
        // Validate discount type
        if (!exports.DISCOUNT_TYPES.includes(input.type)) {
            throw new errors_1.ValidationError(`Invalid discount type: ${input.type}`);
        }
        if (!exports.DISCOUNT_REASONS.includes(input.reason)) {
            throw new errors_1.ValidationError(`Invalid discount reason: ${input.reason}`);
        }
        // Validate value
        if (input.value <= 0) {
            throw new errors_1.ValidationError('Discount value must be positive');
        }
        if (input.type === 'PERCENTAGE' && input.value > 100) {
            throw new errors_1.ValidationError('Percentage discount cannot exceed 100%');
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Get the order
            const order = await tx.order.findUnique({
                where: { id: input.orderId }
            });
            if (!order) {
                throw new errors_1.NotFoundError('Order');
            }
            // 2. Check if order is modifiable
            if (order.paymentStatus === 'PAID') {
                throw new errors_1.ValidationError('Cannot apply discount to a paid order');
            }
            const subtotal = Number(order.subtotal);
            const previousDiscount = Number(order.discount);
            const previousTotal = Number(order.total);
            // 3. Calculate discount amount
            let discountAmount;
            if (input.type === 'PERCENTAGE') {
                discountAmount = (subtotal * input.value) / 100;
            }
            else {
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
        await audit_service_1.auditService.log(client_1.AuditAction.DISCOUNT_APPLIED, 'Order', input.orderId, context, {
            type: input.type,
            value: input.value,
            reason: input.reason,
            notes: input.notes,
            authorizerId: input.authorizerId,
            discountAmount: result.discountAmount,
            previousTotal: result.previousTotal,
            newTotal: result.newTotal
        });
        logger_1.logger.info('Discount applied to order', {
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
    async removeDiscount(orderId, context) {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId }
            });
            if (!order) {
                throw new errors_1.NotFoundError('Order');
            }
            if (order.paymentStatus === 'PAID') {
                throw new errors_1.ValidationError('Cannot remove discount from a paid order');
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
        await audit_service_1.auditService.log(client_1.AuditAction.DISCOUNT_APPLIED, 'Order', orderId, context, {
            action: 'REMOVED',
            discountRemoved: result.discountRemoved,
            newTotal: result.newTotal
        });
        logger_1.logger.info('Discount removed from order', {
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
    getDiscountReasons() {
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
    getDiscountTypes() {
        return [
            { code: 'PERCENTAGE', label: 'Porcentaje (%)' },
            { code: 'FIXED', label: 'Monto fijo ($)' }
        ];
    }
}
exports.DiscountService = DiscountService;
exports.discountService = new DiscountService();
//# sourceMappingURL=discount.service.js.map