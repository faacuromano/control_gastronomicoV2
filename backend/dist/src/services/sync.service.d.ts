/**
 * @fileoverview Sync Service for offline synchronization
 * Handles pull (server→client) and push (client→server) operations
 *
 * @module services/sync.service
 */
import { type AuditContext } from './audit.service';
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse } from '../types/sync.types';
/**
 * Service for handling offline data synchronization
 */
export declare class SyncService {
    /**
     * Pull all data needed for offline operation
     * Called when client goes online or on startup
     */
    pull(): Promise<SyncPullResponse>;
    /**
     * Push offline operations to server
     * Processes orders and payments created offline
     */
    push(request: SyncPushRequest, context: AuditContext): Promise<SyncPushResponse>;
    /**
     * Process a single offline order
     */
    private processOfflineOrder;
    /**
     * Process a single offline payment
     */
    private processOfflinePayment;
    private getProductsForSync;
    private getCategoriesForSync;
    private getPrinterRoutingForSync;
    private generateSyncToken;
}
export declare const syncService: SyncService;
//# sourceMappingURL=sync.service.d.ts.map