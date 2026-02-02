/**
 * @fileoverview Servicio de descuentos manuales sobre órdenes.
 *
 * Permite aplicar y remover descuentos (porcentuales o fijos) a órdenes abiertas,
 * con validaciones de negocio, registro en auditoría y recálculo automático del
 * estado de pago. Incluye bloqueo a nivel de fila (FOR UPDATE) para prevenir
 * condiciones de carrera al aplicar descuentos concurrentes sobre la misma orden.
 *
 * @module services/discount.service
 * @phase2 Funcionalidades Operativas
 */

import { prisma } from '../lib/prisma';
import { AuditAction, PaymentStatus } from '@prisma/client';
import { auditService, AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Tipos de descuento soportados: porcentaje o monto fijo.
 */
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type DiscountType = typeof DISCOUNT_TYPES[number];

/**
 * Razones/categorías de descuento para clasificación y auditoría.
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
    value: number;       // Porcentaje (0-100) o monto fijo
    reason: DiscountReason;
    notes?: string;
    authorizerId?: number;  // Gerente que autorizó (opcional por ahora)
}

export interface DiscountResult {
    success: boolean;
    orderId: number;
    previousTotal: number;
    discountAmount: number;
    newTotal: number;
}

/**
 * Servicio para gestionar descuentos en órdenes.
 * Cada operación se ejecuta en transacción con bloqueo de fila para seguridad concurrente.
 */
export class DiscountService {

    /**
     * Aplica un descuento a una orden.
     *
     * Flujo:
     * 1. Valida tipo, razón y valor del descuento
     * 2. Bloquea la fila de la orden (FOR UPDATE) para prevenir carrera
     * 3. Verifica que la orden no esté pagada
     * 4. Calcula el monto del descuento (% o fijo)
     * 5. Limita el descuento total para no exceder el subtotal
     * 6. Recalcula el estado de pago (los pagos existentes podrían cubrir el nuevo total)
     * 7. Registra en auditoría
     *
     * @param input - Parámetros del descuento
     * @param tenantId - ID del tenant para aislamiento
     * @param context - Contexto de auditoría
     * @returns Resultado con totales anteriores y nuevos
     */
    async applyDiscount(
        input: ApplyDiscountInput,
        tenantId: number,
        context: AuditContext
    ): Promise<DiscountResult> {
        // Validar tipo de descuento
        if (!DISCOUNT_TYPES.includes(input.type)) {
            throw new ValidationError(`Invalid discount type: ${input.type}`);
        }

        if (!DISCOUNT_REASONS.includes(input.reason)) {
            throw new ValidationError(`Invalid discount reason: ${input.reason}`);
        }

        // Validar que el valor sea positivo
        if (input.value <= 0) {
            throw new ValidationError('Discount value must be positive');
        }

        if (input.type === 'PERCENTAGE' && input.value > 100) {
            throw new ValidationError('Percentage discount cannot exceed 100%');
        }

        const result = await prisma.$transaction(async (tx) => {
            // Bloqueo exclusivo de fila para prevenir carrera de descuentos concurrentes
            await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${input.orderId} AND tenantId = ${tenantId} FOR UPDATE`;

            // 1. Obtener la orden con pagos existentes (aislada por tenant)
            const order = await tx.order.findFirst({
                where: { id: input.orderId, tenantId },
                include: { payments: true }
            });

            if (!order) {
                throw new NotFoundError('Order');
            }

            // 2. Verificar que la orden sea modificable (no pagada)
            if (order.paymentStatus === 'PAID') {
                throw new ValidationError('Cannot apply discount to a paid order');
            }

            const subtotal = Number(order.subtotal);
            const previousDiscount = Number(order.discount);
            const previousTotal = Number(order.total);

            // 3. Calcular monto del descuento según tipo
            let discountAmount: number;
            if (input.type === 'PERCENTAGE') {
                discountAmount = (subtotal * input.value) / 100;
            } else {
                discountAmount = input.value;
            }

            // 4. Limitar el descuento total para que no exceda el subtotal
            const totalDiscount = Math.min(previousDiscount + discountAmount, subtotal);
            discountAmount = totalDiscount - previousDiscount;
            const newTotal = Math.max(subtotal - totalDiscount, 0);

            // 5. Recalcular estado de pago — pagos existentes podrían cubrir el nuevo total menor
            const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            let newPaymentStatus: PaymentStatus = order.paymentStatus;
            if (totalPaid >= newTotal) {
                newPaymentStatus = PaymentStatus.PAID;
            } else if (totalPaid > 0) {
                newPaymentStatus = PaymentStatus.PARTIAL;
            }

            // SAFE: tx.order.findFirst verifica propiedad del tenant
            const isNowPaid = newPaymentStatus === PaymentStatus.PAID;
            await tx.order.update({
                where: { id: input.orderId },
                data: {
                    discount: totalDiscount,
                    total: newTotal,
                    paymentStatus: newPaymentStatus,
                    ...(isNowPaid && !order.closedAt ? { closedAt: new Date() } : {})
                }
            });

            return {
                previousTotal,
                discountAmount,
                newTotal,
                totalDiscount,
                paymentStatus: newPaymentStatus
            };
        });

        // 6. Registrar en pista de auditoría
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
     * Elimina todos los descuentos de una orden, restaurando el total original.
     * Recalcula el estado de pago con el total restaurado.
     */
    async removeDiscount(
        orderId: number,
        tenantId: number,
        context: AuditContext
    ): Promise<DiscountResult> {
        const result = await prisma.$transaction(async (tx) => {
            // Bloqueo exclusivo de fila para prevenir carrera de descuentos concurrentes
            await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} AND tenantId = ${tenantId} FOR UPDATE`;

            const order = await tx.order.findFirst({
                where: { id: orderId, tenantId },
                include: { payments: true }
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
            const newTotal = subtotal;

            // Recalcular estado de pago con el total restaurado (sin descuento)
            const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            let newPaymentStatus: PaymentStatus = order.paymentStatus;
            if (totalPaid >= newTotal) {
                newPaymentStatus = PaymentStatus.PAID;
            } else if (totalPaid > 0) {
                newPaymentStatus = PaymentStatus.PARTIAL;
            } else {
                newPaymentStatus = PaymentStatus.PENDING;
            }

            // SAFE: tx.order.findFirst verifica propiedad del tenant
            await tx.order.update({
                where: { id: orderId },
                data: {
                    discount: 0,
                    total: newTotal,
                    paymentStatus: newPaymentStatus
                }
            });

            return {
                previousTotal,
                discountRemoved: previousDiscount,
                newTotal
            };
        });

        // Registrar la eliminación del descuento en auditoría
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
     * Retorna las razones de descuento disponibles para el dropdown de la UI.
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
     * Retorna los tipos de descuento disponibles para el dropdown de la UI.
     */
    getDiscountTypes(): { code: DiscountType; label: string }[] {
        return [
            { code: 'PERCENTAGE', label: 'Porcentaje (%)' },
            { code: 'FIXED', label: 'Monto fijo ($)' }
        ];
    }
}

export const discountService = new DiscountService();
