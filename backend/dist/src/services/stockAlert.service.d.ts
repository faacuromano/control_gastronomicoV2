/**
 * Stock Alert Service
 * Monitors stock levels and emits WebSocket alerts when below threshold
 */
export interface StockAlert {
    id: number;
    ingredientId: number;
    ingredientName: string;
    currentStock: number;
    minStock: number;
    unit: string;
    severity: 'warning' | 'critical';
    timestamp: Date;
}
declare class StockAlertService {
    /**
     * Check if ingredient is below minimum stock and emit alert if so
     */
    checkAndAlert(ingredientId: number, newStock: number): Promise<void>;
    /**
     * Emit stock alert via WebSocket to admin:stock room
     */
    private emitAlert;
    /**
     * Get all ingredients currently below minimum stock
     */
    getLowStockItems(): Promise<StockAlert[]>;
    /**
     * Broadcast current low stock status to all connected admin clients
     */
    broadcastLowStockStatus(): Promise<void>;
}
export declare const stockAlertService: StockAlertService;
export {};
//# sourceMappingURL=stockAlert.service.d.ts.map