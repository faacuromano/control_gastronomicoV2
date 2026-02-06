import api from '../lib/api';

export interface Client {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxId?: string;
    points: number;
    walletBalance: number | string;
}

export interface LoyaltyBalance {
    points: number;
    walletBalance: number;
}

export interface LoyaltyConfig {
    pointsPerDollar: number;
    pointsRedeemValue: number;
}

export const clientService = {
    async search(query: string = '') {
        const response = await api.get(`/clients/search?q=${encodeURIComponent(query)}`);
        return response.data.data as Client[];
    },

    async create(data: Omit<Client, 'id' | 'points' | 'walletBalance'>) {
        const response = await api.post('/clients', data);
        return response.data.data as Client;
    },

    async getLoyaltyBalance(clientId: number): Promise<LoyaltyBalance> {
        const response = await api.get(`/loyalty/${clientId}`);
        return response.data.data;
    },

    async getLoyaltyConfig(): Promise<LoyaltyConfig> {
        const response = await api.get('/loyalty/config');
        return response.data.data;
    },

    async redeemPoints(clientId: number, points: number) {
        const response = await api.post(`/loyalty/${clientId}/redeem`, { points });
        return response.data.data;
    },

    async addWalletFunds(clientId: number, amount: number) {
        const response = await api.post(`/loyalty/${clientId}/wallet/add`, { amount });
        return response.data.data;
    },

    async useWalletFunds(clientId: number, amount: number) {
        const response = await api.post(`/loyalty/${clientId}/wallet/use`, { amount });
        return response.data.data;
    },
};
