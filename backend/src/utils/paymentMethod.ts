/**
 * @fileoverview Mapeo de codigos de metodo de pago dinamicos al enum PaymentMethod de Prisma.
 *
 * Los metodos de pago configurables por tenant (PaymentMethodConfig) usan codigos string
 * arbitrarios como 'EFECTIVO', 'DEBITO', 'MP'. Sin embargo, el modelo Payment de Prisma
 * requiere un valor del enum PaymentMethod (CASH, CARD, TRANSFER, QR_INTEGRATED, ONLINE).
 *
 * Esta funcion actua como puente entre los codigos dinamicos del frontend/configuracion
 * y los valores fijos del enum, manejando aliases comunes en espanol e ingles.
 * Si no se reconoce el codigo, se usa CASH como fallback seguro con un warning en logs.
 *
 * @module utils/paymentMethod
 */

import { PaymentMethod } from '@prisma/client';
import { logger } from './logger';

/**
 * Convierte un codigo de metodo de pago dinamico al enum PaymentMethod de Prisma.
 *
 * Maneja aliases comunes para cada tipo de pago:
 * - CARD: DEBIT, CREDIT, DEBITO, CREDITO, TARJETA
 * - CASH: EFECTIVO
 * - TRANSFER: TRANSFERENCIA, BANCO
 * - QR_INTEGRATED: MERCADOPAGO, MP, QR
 *
 * @param code - Codigo del metodo de pago (case-insensitive, se hace trim automatico)
 * @returns Valor del enum PaymentMethod correspondiente
 *
 * @example
 * mapToPaymentMethod('EFECTIVO')    // -> PaymentMethod.CASH
 * mapToPaymentMethod('tarjeta')     // -> PaymentMethod.CARD
 * mapToPaymentMethod('MP')          // -> PaymentMethod.QR_INTEGRATED
 * mapToPaymentMethod('CARD')        // -> PaymentMethod.CARD (match directo con el enum)
 * mapToPaymentMethod('desconocido') // -> PaymentMethod.CASH (fallback con warning)
 */
export function mapToPaymentMethod(code: string): PaymentMethod {
    const codeUpper = code.toUpperCase().trim();

    // Primero intenta match directo con el enum de Prisma (CASH, CARD, TRANSFER, etc.)
    if (codeUpper in PaymentMethod) {
        return PaymentMethod[codeUpper as keyof typeof PaymentMethod];
    }
    // Aliases de tarjeta (debito, credito, tarjeta en espanol e ingles)
    if (['DEBIT', 'CREDIT', 'DEBITO', 'CREDITO', 'TARJETA'].includes(codeUpper)) {
        return PaymentMethod.CARD;
    }
    // Alias de efectivo en espanol
    if (['EFECTIVO'].includes(codeUpper)) {
        return PaymentMethod.CASH;
    }
    // Aliases de transferencia bancaria
    if (['TRANSFERENCIA', 'BANCO'].includes(codeUpper)) {
        return PaymentMethod.TRANSFER;
    }
    // Aliases de pago QR / MercadoPago (muy comun en Argentina)
    if (['MERCADOPAGO', 'MP', 'QR'].includes(codeUpper)) {
        return PaymentMethod.QR_INTEGRATED;
    }

    // Fallback seguro: si no se reconoce el codigo, se asume CASH y se registra warning
    // para que el equipo pueda agregar el alias faltante en una futura actualizacion
    logger.warn('Unknown payment method code, defaulting to CASH', { code });
    return PaymentMethod.CASH;
}
