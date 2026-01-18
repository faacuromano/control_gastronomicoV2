/**
 * @fileoverview Analytics service with database-level aggregations.
 *
 * PERFORMANCE NOTE:
 * All aggregations are performed at the database level using Prisma's
 * aggregate/groupBy methods. This is much more efficient than loading
 * entire tables into memory.
 *
 * @module services/analytics.service
 */
interface DateRange {
    startDate: Date;
    endDate: Date;
}
interface SalesSummary {
    totalRevenue: number;
    orderCount: number;
    averageTicket: number;
    previousPeriodRevenue: number;
    revenueChange: number;
}
interface TopProduct {
    productId: number;
    productName: string;
    quantitySold: number;
    revenue: number;
}
interface PaymentBreakdown {
    method: string;
    total: number;
    count: number;
    percentage: number;
}
interface ChannelSales {
    channel: string;
    total: number;
    count: number;
    percentage: number;
}
interface LowStockItem {
    id: number;
    name: string;
    unit: string;
    currentStock: number;
    minStock: number;
    deficit: number;
}
export declare class AnalyticsService {
    /**
     * Get sales summary for a date range using database aggregation.
     *
     * PERFORMANCE: Uses Prisma aggregate instead of loading all orders.
     * O(1) database query instead of O(n) memory processing.
     */
    getSalesSummary(range: DateRange): Promise<SalesSummary>;
    /**
     * Get top selling products using database aggregation.
     *
     * PERFORMANCE: Uses Prisma groupBy instead of loading all order items.
     * O(n products) instead of O(n order items).
     */
    getTopProducts(limit?: number, range?: DateRange): Promise<TopProduct[]>;
    /**
     * Get payment method breakdown using database groupBy.
     */
    getPaymentBreakdown(range?: DateRange): Promise<PaymentBreakdown[]>;
    /**
     * Get sales by channel using database groupBy.
     */
    getSalesByChannel(range?: DateRange): Promise<ChannelSales[]>;
    /**
     * Get ingredients with stock below minimum using raw SQL for efficiency.
     *
     * PERFORMANCE: Uses database-level WHERE filter instead of loading all ingredients.
     */
    getLowStockItems(): Promise<LowStockItem[]>;
    /**
     * Get daily sales for charts using database groupBy with businessDate.
     *
     * PERFORMANCE: Uses groupBy on businessDate for efficient aggregation.
     */
    getDailySales(range: DateRange): Promise<{
        date: string;
        total: number;
        count: number;
    }[]>;
}
export declare const analyticsService: AnalyticsService;
export {};
//# sourceMappingURL=analytics.service.d.ts.map