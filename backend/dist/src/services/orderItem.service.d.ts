/**
 * @fileoverview Order item validation and calculation service.
 * Handles product validation, price calculation, and stock preparation.
 *
 * @module services/orderItem.service
 * @extracted_from order.service.ts (Phase 2 Refactoring)
 */
import { Prisma } from '@prisma/client';
import type { OrderItemInput, ItemCalculationResult } from '../types/order.types';
/**
 * Service for order item operations.
 * Responsible for validating products and calculating totals.
 */
export declare class OrderItemService {
    /**
     * Validate products and calculate order totals.
     *
     * SECURITY: Modifier prices are fetched from database, NOT trusted from frontend.
     * This prevents price manipulation attacks.
     *
     * @param tx - Prisma transaction client
     * @param items - Array of order item inputs
     * @param stockEnabled - If true, validates stock availability
     * @returns Calculated item data, stock updates, and subtotal
     */
    validateAndCalculateItems(tx: Prisma.TransactionClient, items: OrderItemInput[], stockEnabled?: boolean): Promise<ItemCalculationResult>;
    /**
     * Build item notes including removed ingredients.
     */
    private buildItemNotes;
    /**
     * Calculate stock updates for an item.
     * Validates stock availability if stockEnabled is true.
     */
    private calculateStockUpdates;
}
export declare const orderItemService: OrderItemService;
//# sourceMappingURL=orderItem.service.d.ts.map