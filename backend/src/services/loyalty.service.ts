/**
 * @fileoverview Servicio de Fidelizacion (Loyalty)
 *
 * Gestiona el sistema de puntos y billetera virtual de los clientes.
 * Los clientes acumulan puntos por cada compra y pueden canjearlos por descuentos.
 * Tambien pueden cargar saldo en su billetera virtual para pagos rapidos.
 *
 * Las constantes de puntos son configurables via variables de entorno
 * y en el futuro se podran configurar por tenant.
 *
 * SEGURIDAD: Todas las operaciones de puntos y billetera usan updateMany con
 * tenantId en la clausula WHERE para garantizar aislamiento multi-tenant.
 * Las operaciones de decremento incluyen condiciones atomicas (gte) para
 * prevenir saldos negativos incluso en accesos concurrentes.
 *
 * @module services/loyalty.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

// BIZ-014: Constantes de fidelizacion configurables via variables de entorno.
// Se pueden sobreescribir por deployment; la configuracion por tenant es una mejora futura.
const POINTS_PER_DOLLAR = parseInt(process.env.LOYALTY_POINTS_PER_DOLLAR || '10', 10);
const POINTS_TO_REDEEM_VALUE = parseInt(process.env.LOYALTY_POINTS_REDEEM_VALUE || '100', 10);

export interface LoyaltyBalance {
    clientId: number;
    points: number;
    walletBalance: number;
    pointsValue: number;  // Valor monetario de los puntos acumulados
}

export class LoyaltyService {
    /**
     * Obtiene el balance de fidelizacion de un cliente: puntos, saldo de billetera
     * y el valor monetario equivalente de los puntos.
     */
    async getBalance(clientId: number, tenantId: number): Promise<LoyaltyBalance> {
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId }
        });

        if (!client) {
            throw new NotFoundError('Client');
        }

        return {
            clientId: client.id,
            points: client.points,
            walletBalance: Number(client.walletBalance),
            pointsValue: client.points / POINTS_TO_REDEEM_VALUE
        };
    }

    /**
     * Otorga puntos al cliente basado en el monto de la compra.
     * Se llama despues de completar exitosamente una orden.
     *
     * Soporta transaccion externa (externalTx) para ejecutarse atomicamente
     * junto con la creacion de la orden.
     *
     * @param clientId - ID del cliente a premiar
     * @param orderTotal - Monto total de la orden para calcular puntos
     * @param externalTx - Cliente de transaccion Prisma opcional para operaciones atomicas
     */
    async awardPoints(clientId: number, orderTotal: number, externalTx?: Prisma.TransactionClient, tenantId?: number): Promise<number> {
        const pointsEarned = Math.floor(orderTotal * POINTS_PER_DOLLAR);

        if (pointsEarned <= 0) return 0;

        if (!tenantId) {
            throw new ValidationError('tenantId is required for awardPoints');
        }

        const db = externalTx || prisma;

        // Verificar que el cliente pertenezca al tenant y actualizar atomicamente
        const result = await db.client.updateMany({
            where: { id: clientId, tenantId },
            data: {
                points: { increment: pointsEarned }
            }
        });

        if (result.count === 0) throw new NotFoundError('Client');

        return pointsEarned;
    }

    /**
     * Canjea puntos del cliente por un descuento monetario.
     * Retorna el monto del descuento aplicado.
     *
     * Usa una operacion atomica: solo decrementa si hay puntos suficientes (gte).
     * Si falla, diagnostica si el cliente no existe o si tiene puntos insuficientes.
     */
    async redeemPoints(clientId: number, pointsToRedeem: number, tenantId: number): Promise<number> {
        if (pointsToRedeem <= 0) {
            throw new ValidationError('Points to redeem must be positive');
        }

        const discountAmount = pointsToRedeem / POINTS_TO_REDEEM_VALUE;

        // Operacion atomica: solo decrementa si existen puntos suficientes
        const result = await prisma.client.updateMany({
            where: {
                id: clientId,
                tenantId,
                points: { gte: pointsToRedeem }
            },
            data: {
                points: { decrement: pointsToRedeem }
            }
        });

        if (result.count === 0) {
            // Diagnosticar: el cliente no existe o tiene puntos insuficientes
            const client = await prisma.client.findFirst({
                where: { id: clientId, tenantId }
            });
            if (!client) throw new NotFoundError('Client');
            throw new ValidationError(`Insufficient points. Available: ${client.points}`);
        }

        return discountAmount;
    }

    /**
     * Agrega fondos a la billetera virtual del cliente.
     * Retorna el nuevo saldo despues de la carga.
     */
    async addWalletFunds(clientId: number, amount: number, tenantId: number): Promise<number> {
        if (amount <= 0) {
            throw new ValidationError('Amount must be positive');
        }

        const result = await prisma.client.updateMany({
            where: { id: clientId, tenantId },
            data: {
                walletBalance: { increment: amount }
            }
        });

        if (result.count === 0) throw new NotFoundError('Client');

        // Obtener saldo actualizado para retornarlo
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId },
            select: { walletBalance: true }
        });

        return Number(client!.walletBalance);
    }

    /**
     * Usa fondos de la billetera virtual para un pago.
     * Retorna el monto efectivamente utilizado (puede ser menor si el saldo es insuficiente).
     *
     * Usa condicion atomica (gte) para prevenir saldos negativos incluso
     * con accesos concurrentes al mismo cliente.
     */
    async useWalletFunds(clientId: number, amount: number, tenantId: number): Promise<number> {
        if (amount <= 0) return 0;

        // Obtener saldo actual para calcular cuanto se puede usar
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId }
        });

        if (!client) throw new NotFoundError('Client');

        const availableBalance = Number(client.walletBalance);
        const amountToUse = Math.min(amount, availableBalance);

        if (amountToUse <= 0) return 0;

        // Operacion atomica: solo decrementa si hay saldo suficiente (previene concurrencia)
        const result = await prisma.client.updateMany({
            where: {
                id: clientId,
                tenantId,
                walletBalance: { gte: amountToUse }
            },
            data: {
                walletBalance: { decrement: amountToUse }
            }
        });

        if (result.count === 0) {
            throw new ValidationError('Insufficient wallet balance (concurrent modification)');
        }

        return amountToUse;
    }

    /**
     * Retorna la configuracion de puntos para mostrar en el frontend.
     * Permite al usuario saber cuantos puntos gana y cuanto valen.
     */
    getConfig() {
        return {
            pointsPerDollar: POINTS_PER_DOLLAR,
            pointsToRedeemValue: POINTS_TO_REDEEM_VALUE,
            description: `Gana ${POINTS_PER_DOLLAR} puntos por cada $1. Canjea ${POINTS_TO_REDEEM_VALUE} puntos por $1 de descuento.`
        };
    }
}
