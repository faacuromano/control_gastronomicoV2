/**
 * Loyalty Service
 * Handles API calls for loyalty/rewards program
 */

import api from '../lib/api';

export interface LoyaltyBalance {
    clientId: number;
    points: number;
    walletBalance: number;
    pointsValue: number;  // Monetary value of points
}

export interface LoyaltyConfig {
    pointsPerDollar: number;
    pointsToRedeemValue: number;
    description: string;
}

class LoyaltyService {
    /**
     * Get loyalty configuration (points rates)
     */
    async getConfig(): Promise<LoyaltyConfig> {
        const response = await api.get('/loyalty/config');
        return response.data.data;
    }

    /**
     * Get client's loyalty balance
     */
    async getBalance(clientId: number): Promise<LoyaltyBalance> {
        const response = await api.get(`/loyalty/${clientId}`);
        return response.data.data;
    }

    /**
     * Redeem points for discount
     * @returns The discount amount applied
     */
    async redeemPoints(clientId: number, pointsToRedeem: number): Promise<{ discountApplied: number }> {
        const response = await api.post(`/loyalty/${clientId}/redeem`, { points: pointsToRedeem });
        return response.data.data;
    }

    /**
     * Add funds to wallet
     */
    async addWalletFunds(clientId: number, amount: number): Promise<{ newBalance: number }> {
        const response = await api.post(`/loyalty/${clientId}/wallet/add`, { amount });
        return response.data.data;
    }

    /**
     * Use wallet funds for payment
     */
    async useWalletFunds(clientId: number, amount: number): Promise<{ amountUsed: number }> {
        const response = await api.post(`/loyalty/${clientId}/wallet/use`, { amount });
        return response.data.data;
    }

    /**
     * Calculate monetary value of points
     */
    calculatePointsValue(points: number, config: LoyaltyConfig): number {
        return points / config.pointsToRedeemValue;
    }
}

export const loyaltyService = new LoyaltyService();
