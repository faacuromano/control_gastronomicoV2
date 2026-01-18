"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyService = void 0;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
// Configuration - Could be moved to TenantConfig later
const POINTS_PER_DOLLAR = 10; // 10 points per $1 spent
const POINTS_TO_REDEEM_VALUE = 100; // 100 points = $1 discount
class LoyaltyService {
    /**
     * Get client's loyalty balance
     */
    async getBalance(clientId) {
        const client = await prisma_1.prisma.client.findUnique({
            where: { id: clientId }
        });
        if (!client) {
            throw new errors_1.NotFoundError('Client');
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
    async awardPoints(clientId, orderTotal, externalTx) {
        const pointsEarned = Math.floor(orderTotal * POINTS_PER_DOLLAR);
        if (pointsEarned <= 0)
            return 0;
        const db = externalTx || prisma_1.prisma;
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
    async redeemPoints(clientId, pointsToRedeem) {
        const client = await prisma_1.prisma.client.findUnique({
            where: { id: clientId }
        });
        if (!client) {
            throw new errors_1.NotFoundError('Client');
        }
        if (pointsToRedeem <= 0) {
            throw new errors_1.ValidationError('Points to redeem must be positive');
        }
        if (pointsToRedeem > client.points) {
            throw new errors_1.ValidationError(`Insufficient points. Available: ${client.points}`);
        }
        // Calculate discount value
        const discountAmount = pointsToRedeem / POINTS_TO_REDEEM_VALUE;
        // Deduct points
        await prisma_1.prisma.client.update({
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
    async addWalletFunds(clientId, amount) {
        if (amount <= 0) {
            throw new errors_1.ValidationError('Amount must be positive');
        }
        const client = await prisma_1.prisma.client.update({
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
    async useWalletFunds(clientId, amount) {
        const client = await prisma_1.prisma.client.findUnique({
            where: { id: clientId }
        });
        if (!client) {
            throw new errors_1.NotFoundError('Client');
        }
        const availableBalance = Number(client.walletBalance);
        const amountToUse = Math.min(amount, availableBalance);
        if (amountToUse <= 0) {
            return 0;
        }
        await prisma_1.prisma.client.update({
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
exports.LoyaltyService = LoyaltyService;
//# sourceMappingURL=loyalty.service.js.map