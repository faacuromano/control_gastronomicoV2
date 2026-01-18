/**
 * @fileoverview Order item transfer service.
 * Handles moving items between tables with audit logging.
 *
 * @module services/orderTransfer.service
 * @phase2 Operational Features
 */
import { AuditContext } from './audit.service';
export interface TransferResult {
    success: boolean;
    itemsTransferred: number;
    fromOrderId: number;
    toOrderId: number | null;
    newOrderCreated: boolean;
}
/**
 * Service for transferring order items between tables.
 */
export declare class OrderTransferService {
    /**
     * Transfer items from one table to another.
     *
     * If target table has an open order, items are added to it.
     * If not, a new order is created for the target table.
     *
     * @param itemIds - IDs of items to transfer
     * @param fromTableId - Source table ID
     * @param toTableId - Target table ID
     * @param context - Audit context
     */
    transferItems(itemIds: number[], fromTableId: number, toTableId: number, context: AuditContext): Promise<TransferResult>;
}
export declare const orderTransferService: OrderTransferService;
//# sourceMappingURL=orderTransfer.service.d.ts.map