import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

// Configuration - Could be moved to TenantConfig later
const POINTS_PER_DOLLAR = 10;  // 10 points per $1 spent
const POINTS_TO_REDEEM_VALUE = 100;  // 100 points = $1 discount

export interface LoyaltyBalance {
    clientId: number;
    points: number;
    walletBalance: number;
    pointsValue: number;  // Monetary value of points
}

export class LoyaltyService {
    /**
     * Get client's loyalty balance
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
     * Award points based on purchase amount
     * Called after successful order completion
     * 
     * @param clientId - Client to award points to
     * @param orderTotal - Total order amount for calculating points
     * @param externalTx - Optional Prisma transaction client for atomic operations
     */
    async awardPoints(clientId: number, orderTotal: number, externalTx?: Prisma.TransactionClient, tenantId?: number): Promise<number> {
        const pointsEarned = Math.floor(orderTotal * POINTS_PER_DOLLAR);

        if (pointsEarned <= 0) return 0;

        if (!tenantId) {
            throw new ValidationError('tenantId is required for awardPoints');
        }

        const db = externalTx || prisma;

        // Verify client belongs to tenant and update atomically
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
     * Redeem points for discount
     * Returns the discount amount applied
     */
    async redeemPoints(clientId: number, pointsToRedeem: number, tenantId: number): Promise<number> {
        if (pointsToRedeem <= 0) {
            throw new ValidationError('Points to redeem must be positive');
        }

        const discountAmount = pointsToRedeem / POINTS_TO_REDEEM_VALUE;

        // Atomic: only decrements if sufficient points exist
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
            // Either client doesn't exist or insufficient points
            const client = await prisma.client.findFirst({
                where: { id: clientId, tenantId }
            });
            if (!client) throw new NotFoundError('Client');
            throw new ValidationError(`Insufficient points. Available: ${client.points}`);
        }

        return discountAmount;
    }

    /**
     * Add funds to wallet
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

        // Fetch updated balance to return
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId },
            select: { walletBalance: true }
        });

        return Number(client!.walletBalance);
    }

    /**
     * Use wallet funds for payment
     * Returns amount actually used (may be less if insufficient balance)
     */
    async useWalletFunds(clientId: number, amount: number, tenantId: number): Promise<number> {
        if (amount <= 0) return 0;

        // First get the current balance to calculate amountToUse
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId }
        });

        if (!client) throw new NotFoundError('Client');

        const availableBalance = Number(client.walletBalance);
        const amountToUse = Math.min(amount, availableBalance);

        if (amountToUse <= 0) return 0;

        // Atomic: only decrements if sufficient balance
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
     * Get points configuration (for frontend display)
     */
    getConfig() {
        return {
            pointsPerDollar: POINTS_PER_DOLLAR,
            pointsToRedeemValue: POINTS_TO_REDEEM_VALUE,
            description: `Gana ${POINTS_PER_DOLLAR} puntos por cada $1. Canjea ${POINTS_TO_REDEEM_VALUE} puntos por $1 de descuento.`
        };
    }
}
