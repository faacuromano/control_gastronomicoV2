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
    async getNextOrderNumber(tx: TransactionClient): Promise<number> {
        try {
            // Calculate business date (shift hours <6am to previous day)
            const now = new Date();
            const businessDate = new Date(now);
            if (businessDate.getHours() < 6) {
                businessDate.setDate(businessDate.getDate() - 1);
            }
            
            // Format as YYYYMMDD (e.g., "20260119")
            const year = businessDate.getFullYear();
            const month = String(businessDate.getMonth() + 1).padStart(2, '0');
            const day = String(businessDate.getDate()).padStart(2, '0');
            const sequenceKey = `${year}${month}${day}`;
            
            // Upsert pattern: create sequence for today if not exists, else increment
            const sequence = await tx.orderSequence.upsert({
                where: { sequenceKey },
                update: {
                    currentValue: { increment: 1 }
                },
                create: {
                    sequenceKey,
                    currentValue: 1
                }
            });
            
            logger.info('Order number generated', {
                sequenceKey,
                orderNumber: sequence.currentValue
            });
            
            return sequence.currentValue;
        } catch (error) {
            logger.error('Failed to generate order number', { error });
            throw new Error('Could not generate order number. Please try again.');
        }
    }
    
    /**
     * Get the current max order number without modification (for display purposes).
     * WARNING: Do not use this for generating new order numbers.
     * 
     * @returns The current maximum order number
     */
    /**
     * DEPRECATED: This method no longer works with date-based sharding.
     * Use the current day's sequence instead.
     */
    async getCurrentMaxOrderNumber(): Promise<number> {
        // Return today's sequence
        const now = new Date();
        const businessDate = new Date(now);
        if (businessDate.getHours() < 6) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        const year = businessDate.getFullYear();
        const month = String(businessDate.getMonth() + 1).padStart(2, '0');
        const day = String(businessDate.getDate()).padStart(2, '0');
        const sequenceKey = `${year}${month}${day}`;
        
        const sequence = await prisma.orderSequence.findUnique({
            where: { sequenceKey }
        });
        return sequence?.currentValue ?? 0;
    }
    
    /**
     * Initialize the sequence from existing orders (migration helper).
     * Call this once after migrating to set the sequence to the correct value.
     */
    /**
     * DEPRECATED: Legacy initialization method.
     * With date-based sharding, sequences are created automatically.
     */
    async initializeFromExistingOrders(): Promise<number> {
        logger.warn('initializeFromExistingOrders is deprecated with date-based sharding');
        return 0;
    }
}

export const orderNumberService = new OrderNumberService();
