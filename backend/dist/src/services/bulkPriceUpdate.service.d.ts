/**
 * Bulk Price Update Service
 * Handles mass price updates for products with preview and categorical updates
 *
 * @module services/bulkPriceUpdate.service
 */
import { AuditContext } from './audit.service';
export type PriceUpdateType = 'PERCENTAGE' | 'FIXED';
export interface BulkPriceUpdateInput {
    type: PriceUpdateType;
    value: number;
    round?: boolean | undefined;
}
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
export interface BulkUpdateResult {
    productsUpdated: number;
    totalPreviousValue: number;
    totalNewValue: number;
    changes: ProductPriceChange[];
}
export declare class BulkPriceUpdateService {
    /**
     * Get all products with current prices for the bulk update grid
     */
    getProductsForPriceGrid(filters?: {
        categoryId?: number | undefined;
    }): Promise<ProductPriceChange[]>;
    /**
     * Preview price changes without applying them
     */
    previewBulkUpdate(products: ProductPriceChange[], input: BulkPriceUpdateInput): ProductPriceChange[];
    /**
     * Apply bulk price update to specific products by ID
     */
    applyBulkUpdate(updates: {
        id: number;
        newPrice: number;
    }[], context: AuditContext): Promise<BulkUpdateResult>;
    /**
     * Update prices by category with percentage/fixed increase
     */
    updateByCategory(categoryId: number, input: BulkPriceUpdateInput, context: AuditContext): Promise<BulkUpdateResult>;
    /**
     * Get categories for dropdown
     */
    getCategories(): Promise<{
        name: string;
        id: number;
    }[]>;
}
export declare const bulkPriceUpdateService: BulkPriceUpdateService;
//# sourceMappingURL=bulkPriceUpdate.service.d.ts.map