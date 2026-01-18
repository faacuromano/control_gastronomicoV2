/**
 * @fileoverview Order item void/cancel service.
 * Handles item voiding with stock reversal and audit logging.
 *
 * @module services/orderVoid.service
 * @phase2 Operational Features
 */
import { AuditContext } from './audit.service';
/**
 * Valid reasons for voiding an item.
 */
export declare const VOID_REASONS: readonly ["CUSTOMER_CHANGED_MIND", "WRONG_ITEM", "QUALITY_ISSUE", "OUT_OF_STOCK", "KITCHEN_ERROR", "DUPLICATE_ENTRY", "OTHER"];
export type VoidReason = typeof VOID_REASONS[number];
export interface VoidItemInput {
    orderItemId: number;
    reason: VoidReason;
    notes?: string | undefined;
}
export interface VoidItemResult {
    success: boolean;
    orderItemId: number;
    stockReversed: boolean;
    newOrderTotal: number;
}
/**
 * Service for voiding/cancelling order items.
 */
export declare class OrderVoidService {
    /**
     * Void (remove) an item from an order.
     *
     * This operation:
     * 1. Deletes the item from the order
     * 2. Reverses stock deductions (adds ingredients back)
     * 3. Recalculates order totals
     * 4. Creates an audit log entry
     *
     * @param input - Void item input with reason
     * @param context - Audit context (user, IP)
     * @returns Result with new order total
     */
    voidItem(input: VoidItemInput, context: AuditContext): Promise<VoidItemResult>;
    /**
     * Get available void reasons for UI.
     */
    getVoidReasons(): {
        code: VoidReason;
        label: string;
    }[];
}
export declare const orderVoidService: OrderVoidService;
//# sourceMappingURL=orderVoid.service.d.ts.map