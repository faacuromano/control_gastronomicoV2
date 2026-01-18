/**
 * Bulk Price Update Service
 * Frontend service for mass price updates
 */

import api from '../lib/api';

export type PriceUpdateType = 'PERCENTAGE' | 'FIXED';

export interface ProductPriceChange {
    id: number;
    name: string;
    categoryId: number;
    categoryName: string;
    currentPrice: number;
    newPrice: number;
    difference: number;
    percentChange: number;
}

export interface BulkPriceUpdateInput {
    type: PriceUpdateType;
    value: number;
    round?: boolean;
}

export interface BulkUpdateResult {
    productsUpdated: number;
    totalPreviousValue: number;
    totalNewValue: number;
    changes: ProductPriceChange[];
}

export interface Category {
    id: number;
    name: string;
}

class BulkPriceUpdateService {
    async getProductsForGrid(categoryId?: number): Promise<ProductPriceChange[]> {
        const params = categoryId ? `?categoryId=${categoryId}` : '';
        const response = await api.get(`/bulk-prices/products${params}`);
        return response.data.data;
    }

    async getCategories(): Promise<Category[]> {
        const response = await api.get('/bulk-prices/categories');
        return response.data.data;
    }

    async previewChanges(input: BulkPriceUpdateInput, categoryId?: number): Promise<ProductPriceChange[]> {
        const params = categoryId ? `?categoryId=${categoryId}` : '';
        const response = await api.post(`/bulk-prices/preview${params}`, input);
        return response.data.data;
    }

    async applyUpdates(updates: { id: number; newPrice: number }[]): Promise<BulkUpdateResult> {
        const response = await api.post('/bulk-prices/apply', { updates });
        return response.data.data;
    }

    async updateByCategory(categoryId: number, input: BulkPriceUpdateInput): Promise<BulkUpdateResult> {
        const response = await api.post(`/bulk-prices/category/${categoryId}`, input);
        return response.data.data;
    }

    /**
     * Calculate preview locally without API call
     */
    calculateLocalPreview(
        products: ProductPriceChange[],
        type: PriceUpdateType,
        value: number,
        round: boolean = false
    ): ProductPriceChange[] {
        return products.map(p => {
            let newPrice: number;
            
            if (type === 'PERCENTAGE') {
                newPrice = p.currentPrice * (1 + value / 100);
            } else {
                newPrice = p.currentPrice + value;
            }

            if (round) {
                newPrice = Math.round(newPrice);
            }

            newPrice = Math.max(0, newPrice);

            return {
                ...p,
                newPrice,
                difference: newPrice - p.currentPrice,
                percentChange: p.currentPrice > 0 
                    ? ((newPrice - p.currentPrice) / p.currentPrice) * 100 
                    : 0
            };
        });
    }
}

export const bulkPriceUpdateService = new BulkPriceUpdateService();
