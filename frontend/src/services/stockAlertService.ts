/**
 * Stock Alert Service
 * Frontend service for stock alerts
 */

import api from '../lib/api';

export interface StockAlert {
    id: number;
    ingredientId: number;
    ingredientName: string;
    currentStock: number;
    minStock: number;
    unit: string;
    severity: 'warning' | 'critical';
    timestamp: string;
}

class StockAlertService {
    async getLowStockItems(): Promise<StockAlert[]> {
        const response = await api.get('/stock-alerts');
        return response.data.data;
    }

    async broadcastStatus(): Promise<void> {
        await api.post('/stock-alerts/broadcast');
    }
}

export const stockAlertService = new StockAlertService();
