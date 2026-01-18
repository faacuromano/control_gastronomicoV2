import { Prisma } from '@prisma/client';
export interface LoyaltyBalance {
    clientId: number;
    points: number;
    walletBalance: number;
    pointsValue: number;
}
export declare class LoyaltyService {
    /**
     * Get client's loyalty balance
     */
    getBalance(clientId: number): Promise<LoyaltyBalance>;
    /**
     * Award points based on purchase amount
     * Called after successful order completion
     *
     * @param clientId - Client to award points to
     * @param orderTotal - Total order amount for calculating points
     * @param externalTx - Optional Prisma transaction client for atomic operations
     */
    awardPoints(clientId: number, orderTotal: number, externalTx?: Prisma.TransactionClient): Promise<number>;
    /**
     * Redeem points for discount
     * Returns the discount amount applied
     */
    redeemPoints(clientId: number, pointsToRedeem: number): Promise<number>;
    /**
     * Add funds to wallet
     */
    addWalletFunds(clientId: number, amount: number): Promise<number>;
    /**
     * Use wallet funds for payment
     * Returns amount actually used (may be less if insufficient balance)
     */
    useWalletFunds(clientId: number, amount: number): Promise<number>;
    /**
     * Get points configuration (for frontend display)
     */
    getConfig(): {
        pointsPerDollar: number;
        pointsToRedeemValue: number;
        description: string;
    };
}
//# sourceMappingURL=loyalty.service.d.ts.map