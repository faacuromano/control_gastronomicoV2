import { PaymentMethod } from '@prisma/client';
import { logger } from './logger';

/**
 * Map dynamic payment method codes to the PaymentMethod enum.
 * Handles common aliases (DEBIT→CARD, EFECTIVO→CASH, etc.)
 */
export function mapToPaymentMethod(code: string): PaymentMethod {
    const codeUpper = code.toUpperCase().trim();

    if (codeUpper in PaymentMethod) {
        return PaymentMethod[codeUpper as keyof typeof PaymentMethod];
    }
    if (['DEBIT', 'CREDIT', 'DEBITO', 'CREDITO', 'TARJETA'].includes(codeUpper)) {
        return PaymentMethod.CARD;
    }
    if (['EFECTIVO'].includes(codeUpper)) {
        return PaymentMethod.CASH;
    }
    if (['TRANSFERENCIA', 'BANCO'].includes(codeUpper)) {
        return PaymentMethod.TRANSFER;
    }
    if (['MERCADOPAGO', 'MP', 'QR'].includes(codeUpper)) {
        return PaymentMethod.QR_INTEGRATED;
    }

    logger.warn('Unknown payment method code, defaulting to CASH', { code });
    return PaymentMethod.CASH;
}
