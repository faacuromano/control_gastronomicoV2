/**
 * @fileoverview Servicio de procesamiento de pagos extraido del OrderService.
 * Gestiona la creacion, validacion y calculo de estado de pagos.
 * Soporta tanto pago unico (legacy) como pagos divididos (split payments).
 *
 * @module services/payment.service
 * @adheres Principio de Responsabilidad Unica - Solo maneja operaciones de pago
 */

import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import { ValidationError } from '../utils/errors';

/**
 * Tipo de contexto transaccional para transacciones interactivas de Prisma.
 * Excluye metodos de conexion y transaccion que no son validos dentro de una transaccion.
 */
type TransactionClient = Omit<
    Prisma.TransactionClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Entrada para crear un pago individual dentro de un pago dividido.
 */
export interface PaymentInput {
    method: PaymentMethod;
    amount: number;
}

/**
 * Resultado del procesamiento de pagos con el estado calculado.
 * Contiene los registros de pago listos para crear junto con la orden
 * y el estado resultante (PENDING, PARTIAL, PAID).
 */
export interface PaymentProcessingResult {
    /** Registros de pago listos para crear con la orden */
    paymentsToCreate: {
        amount: number;
        method: PaymentMethod;
        shiftId: number | null;
    }[];
    /** Estado de pago calculado segun el total pagado vs total de la orden */
    paymentStatus: PaymentStatus;
    /** Indica si la orden esta completamente pagada */
    isFullyPaid: boolean;
    /** Monto total pagado sumando todos los pagos */
    totalPaid: number;
}

/**
 * Servicio para procesar y validar pagos.
 * Extraido del OrderService para cumplir con el Principio de Responsabilidad Unica.
 *
 * Soporta dos modos de pago:
 * - Pago unico (legacy): un solo metodo de pago por el total
 * - Pago dividido: multiples metodos de pago que suman el total
 */
export class PaymentService {

    /**
     * Procesa las entradas de pago y calcula el estado final.
     * Soporta tanto pago unico legacy como pagos divididos.
     *
     * @param orderTotal - El monto total de la orden
     * @param shiftId - ID del turno de caja activo para atribucion del pago
     * @param singlePaymentMethod - Legacy: metodo de pago unico (opcional)
     * @param splitPayments - Array de pagos divididos (opcional)
     * @returns Datos de pago procesados listos para la creacion de la orden
     *
     * @example
     * // Pago unico
     * const result = paymentService.processPayments(100, 1, 'CASH', undefined);
     *
     * // Pago dividido (50 efectivo + 50 tarjeta)
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

        // 1. Manejar pago unico (compatibilidad con flujo legacy)
        if (singlePaymentMethod && !splitPayments) {
            paymentsToCreate.push({
                amount: orderTotal,
                method: singlePaymentMethod,
                shiftId
            });
        }

        // 2. Manejar pagos divididos (split payments)
        if (splitPayments && splitPayments.length > 0) {
            this.validatePaymentAmounts(splitPayments, orderTotal);
            for (const payment of splitPayments) {
                if (payment.amount <= 0) {
                    throw new ValidationError(`Invalid payment amount: ${payment.amount}`);
                }
                paymentsToCreate.push({
                    amount: payment.amount,
                    method: payment.method,
                    shiftId
                });
            }
        }

        // 3. Calcular totales y determinar estado de pago
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
     * Valida que los montos de pago sean razonables respecto al total de la orden.
     * Permite hasta un 10% de sobrepago para cubrir redondeos, pero rechaza
     * montos excesivos que podrian indicar un error.
     *
     * @param payments - Array de pagos a validar
     * @param orderTotal - Total de la orden para comparar
     * @throws Error si los pagos exceden el total significativamente
     */
    validatePaymentAmounts(payments: PaymentInput[], orderTotal: number): void {
        const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

        // Permitir hasta 10% de sobrepago por redondeo; mas alla de eso, rechazar
        const maxAllowed = orderTotal * 1.1;
        if (totalPayments > maxAllowed) {
            throw new ValidationError(
                `Payment total (${totalPayments}) exceeds order total (${orderTotal}) by more than 10%`
            );
        }
    }
}

export const paymentService = new PaymentService();
