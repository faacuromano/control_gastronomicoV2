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
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Transaction context type for Prisma interactive transactions.
 */
type TransactionClient = Prisma.TransactionClient;

/**
 * Service for generating unique, sequential order numbers.
 * Uses a dedicated sequence table for high-performance, concurrent-safe generation.
 */
export class OrderNumberService {
    
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
    async getNextOrderNumber(tx: TransactionClient): Promise<number> {
        try {
            // Atomic increment using upsert pattern
            // If sequence doesn't exist (first order), create it with value 1
            // Otherwise, increment the existing value
            const sequence = await tx.orderSequence.upsert({
                where: { id: 1 },
                update: {
                    lastNumber: { increment: 1 }
                },
                create: {
                    id: 1,
                    lastNumber: 1
                }
            });
            
            return sequence.lastNumber;
        } catch (error) {
            // Fallback to raw SQL for edge cases (e.g., concurrent first orders)
            logger.warn('OrderSequence upsert failed, using raw SQL fallback', { error });
            
            const result = await tx.$executeRaw`
                INSERT INTO OrderSequence (id, lastNumber) VALUES (1, 1)
                ON DUPLICATE KEY UPDATE lastNumber = lastNumber + 1
            `;
            
            const seq = await tx.orderSequence.findUnique({ where: { id: 1 } });
            return seq?.lastNumber ?? 1;
        }
    }
    
    /**
     * Get the current max order number without modification (for display purposes).
     * WARNING: Do not use this for generating new order numbers.
     * 
     * @returns The current maximum order number
     */
    async getCurrentMaxOrderNumber(): Promise<number> {
        const sequence = await prisma.orderSequence.findUnique({
            where: { id: 1 }
        });
        return sequence?.lastNumber ?? 0;
    }
    
    /**
     * Initialize the sequence from existing orders (migration helper).
     * Call this once after migrating to set the sequence to the correct value.
     */
    async initializeFromExistingOrders(): Promise<number> {
        const lastOrder = await prisma.order.findFirst({
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true }
        });
        
        const maxNumber = lastOrder?.orderNumber ?? 0;
        
        await prisma.orderSequence.upsert({
            where: { id: 1 },
            update: { lastNumber: maxNumber },
            create: { id: 1, lastNumber: maxNumber }
        });
        
        logger.info('OrderSequence initialized', { lastNumber: maxNumber });
        return maxNumber;
    }
}

export const orderNumberService = new OrderNumberService();
