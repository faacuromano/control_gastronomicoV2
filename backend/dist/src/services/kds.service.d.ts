export declare class KDSService {
    /**
     * Calculate estimated preparation time (in minutes)
     */
    calculatePrepTime(items: any[]): number;
    /**
     * Broadcasts a new order to the Kitchen
     */
    broadcastNewOrder(order: any): void;
    /**
     * Broadcasts an order update
     */
    broadcastOrderUpdate(order: any): void;
    /**
     * Send generic alert to kitchen
     */
    sendAlert(message: string, level?: 'INFO' | 'WARNING' | 'CRITICAL'): void;
}
export declare const kdsService: KDSService;
//# sourceMappingURL=kds.service.d.ts.map