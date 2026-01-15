/**
 * @fileoverview OrderNumber generation service with race-condition-safe implementation.
 * Uses database-level locking to prevent duplicate order numbers.
 * 
 * @module services/orderNumber.service
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Transaction context type for Prisma interactive transactions.
 */
type TransactionClient = Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Service for generating unique, sequential order numbers.
 * Uses SELECT FOR UPDATE to prevent race conditions.
 */
export class OrderNumberService {
    
    /**
     * Generate the next order number in a thread-safe manner.
     * Uses database-level locking (SELECT FOR UPDATE) to prevent race conditions
     * when multiple orders are created simultaneously.
     * 
     * @param tx - Prisma transaction context (required for atomicity)
     * @returns The next sequential order number
     * 
     * @example
     * const orderNumber = await orderNumberService.getNextOrderNumber(tx);
     * // Returns: 1, 2, 3, etc. (sequential, never duplicated)
     * 
     * @remarks
     * This implementation uses raw SQL for the SELECT FOR UPDATE lock,
     * which is not available through Prisma's type-safe API.
     * The lock is released when the transaction commits or rolls back.
     */
    async getNextOrderNumber(tx: TransactionClient): Promise<number> {
        // Use raw query with FOR UPDATE to lock the row and prevent race conditions
        // This ensures only one transaction can read/increment at a time
        const result = await tx.$queryRaw<{ maxOrderNumber: number | null }[]>`
            SELECT MAX(orderNumber) as maxOrderNumber 
            FROM \`Order\` 
            FOR UPDATE
        `;
        
        const currentMax = result[0]?.maxOrderNumber ?? 0;
        return currentMax + 1;
    }
    
    /**
     * Get the last order number without locking (for display purposes only).
     * WARNING: Do not use this for generating new order numbers.
     * 
     * @returns The current maximum order number
     */
    async getCurrentMaxOrderNumber(): Promise<number> {
        const lastOrder = await prisma.order.findFirst({
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true }
        });
        return lastOrder?.orderNumber ?? 0;
    }
}

export const orderNumberService = new OrderNumberService();
