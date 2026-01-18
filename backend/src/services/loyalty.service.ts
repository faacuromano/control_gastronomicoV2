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
    async getBalance(clientId: number): Promise<LoyaltyBalance> {
        const client = await prisma.client.findUnique({
            where: { id: clientId }
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
    async awardPoints(clientId: number, orderTotal: number, externalTx?: Prisma.TransactionClient): Promise<number> {
        const pointsEarned = Math.floor(orderTotal * POINTS_PER_DOLLAR);

        if (pointsEarned <= 0) return 0;

        const db = externalTx || prisma;
        
        await db.client.update({
            where: { id: clientId },
            data: {
                points: { increment: pointsEarned }
            }
        });

        return pointsEarned;
    }

    /**
     * Redeem points for discount
     * Returns the discount amount applied
     */
    async redeemPoints(clientId: number, pointsToRedeem: number): Promise<number> {
        const client = await prisma.client.findUnique({
            where: { id: clientId }
        });

        if (!client) {
            throw new NotFoundError('Client');
        }

        if (pointsToRedeem <= 0) {
            throw new ValidationError('Points to redeem must be positive');
        }

        if (pointsToRedeem > client.points) {
            throw new ValidationError(`Insufficient points. Available: ${client.points}`);
        }

        // Calculate discount value
        const discountAmount = pointsToRedeem / POINTS_TO_REDEEM_VALUE;

        // Deduct points
        await prisma.client.update({
            where: { id: clientId },
            data: {
                points: { decrement: pointsToRedeem }
            }
        });

        return discountAmount;
    }

    /**
     * Add funds to wallet
     */
    async addWalletFunds(clientId: number, amount: number): Promise<number> {
        if (amount <= 0) {
            throw new ValidationError('Amount must be positive');
        }

        const client = await prisma.client.update({
            where: { id: clientId },
            data: {
                walletBalance: { increment: amount }
            }
        });

        return Number(client.walletBalance);
    }

    /**
     * Use wallet funds for payment
     * Returns amount actually used (may be less if insufficient balance)
     */
    async useWalletFunds(clientId: number, amount: number): Promise<number> {
        const client = await prisma.client.findUnique({
            where: { id: clientId }
        });

        if (!client) {
            throw new NotFoundError('Client');
        }

        const availableBalance = Number(client.walletBalance);
        const amountToUse = Math.min(amount, availableBalance);

        if (amountToUse <= 0) {
            return 0;
        }

        await prisma.client.update({
            where: { id: clientId },
            data: {
                walletBalance: { decrement: amountToUse }
            }
        });

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
