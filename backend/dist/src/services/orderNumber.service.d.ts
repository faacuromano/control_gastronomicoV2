/**
 * @fileoverview OrderNumber generation service with efficient sequence-based implementation.
 * Uses a dedicated sequence table instead of locking the entire Order table.
 *
 * @module services/orderNumber.service
 *
 * PERFORMANCE NOTE:
 * Previous implementation used SELECT MAX(orderNumber) FOR UPDATE on the Order table,
 * which serialized all concurrent order creations and caused bottlenecks under load.
 *
 * New implementation uses a dedicated OrderSequence table with atomic increment,
 * which only locks a single row and allows much higher concurrency.
 */
import { Prisma } from '@prisma/client';
/**
 * Transaction context type for Prisma interactive transactions.
 */
type TransactionClient = Prisma.TransactionClient;
/**
 * Service for generating unique, sequential order numbers.
 * Uses a dedicated sequence table for high-performance, concurrent-safe generation.
 */
export declare class OrderNumberService {
    /**
     * Generate the next order number using date-based sharding.
     *
     * FIX P1-001: Eliminates single-row bottleneck by creating a new sequence
     * for each business day. This allows concurrent order creation without deadlocks.
     *
     * Performance improvement:
     * - Old: Single row id=1 locked by ALL concurrent orders (serialized writes)
     * - New: Each day has own row (parallel writes, only locks current day's row)
     *
     * Business logic:
     * - Orders created before 6 AM belong to previous business day
     * - Daily reset provides human-friendly order numbers (#1, #2, #3...)
     * - Historical queries use (businessDate + orderNumber) as composite key
     *
     * @param tx - Prisma transaction context (required for atomicity)
     * @returns The next sequential order number for today's business date
     *
     * @example
     * const orderNumber = await orderNumberService.getNextOrderNumber(tx);
     * // Returns: 1, 2, 3, ... (resets daily)
     */
    getNextOrderNumber(tx: TransactionClient): Promise<number>;
    /**
     * Get the current max order number without modification (for display purposes).
     * WARNING: Do not use this for generating new order numbers.
     *
     * @returns The current maximum order number
     */
    getCurrentMaxOrderNumber(): Promise<number>;
    /**
     * Initialize the sequence from existing orders (migration helper).
     * Call this once after migrating to set the sequence to the correct value.
     */
    initializeFromExistingOrders(): Promise<number>;
}
export declare const orderNumberService: OrderNumberService;
export {};
//# sourceMappingURL=orderNumber.service.d.ts.map