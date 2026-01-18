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
     * Generate the next order number using atomic increment on sequence table.
     *
     * This is significantly faster than the previous FOR UPDATE approach because:
     * 1. Only locks the single sequence row, not the entire Order table
     * 2. Uses database-level atomic increment (single operation)
     * 3. Allows concurrent order creation without serialization
     *
     * @param tx - Prisma transaction context (required for atomicity)
     * @returns The next sequential order number
     *
     * @example
     * const orderNumber = await orderNumberService.getNextOrderNumber(tx);
     * // Returns: 1, 2, 3, etc. (sequential, never duplicated)
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