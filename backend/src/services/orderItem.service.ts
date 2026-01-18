/**
 * @fileoverview Order item validation and calculation service.
 * Handles product validation, price calculation, and stock preparation.
 * 
 * @module services/orderItem.service
 * @extracted_from order.service.ts (Phase 2 Refactoring)
 */

import { Prisma } from '@prisma/client';
import { InsufficientStockError } from '../utils/errors';
import type { 
    OrderItemInput, 
    OrderItemData, 
    StockUpdate, 
    ItemCalculationResult 
} from '../types/order.types';

/**
 * Service for order item operations.
 * Responsible for validating products and calculating totals.
 */
export class OrderItemService {

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
    async validateAndCalculateItems(
        tx: Prisma.TransactionClient,
        items: OrderItemInput[],
        stockEnabled: boolean = true
    ): Promise<ItemCalculationResult> {
        let subtotal = 0;
        const itemDataList: OrderItemData[] = [];
        const stockUpdates: StockUpdate[] = [];

        const productIds = items.map(i => i.productId);
        
        // Collect all modifier IDs from all items for batch fetch
        const allModifierIds = items.flatMap(i => i.modifiers?.map(m => m.id) ?? []);
        
        // Batch fetch products with ingredients
        const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            include: { 
                ingredients: { 
                    include: { ingredient: true }
                } 
            }
        });

        // SECURITY: Batch fetch modifier prices from database
        // This ensures we use the real price, not whatever the frontend sends
        const modifierOptions = allModifierIds.length > 0 
            ? await tx.modifierOption.findMany({
                where: { id: { in: allModifierIds } },
                select: { id: true, priceOverlay: true, name: true }
            })
            : [];
        
        const modifierPriceMap = new Map(
            modifierOptions.map(m => [m.id, Number(m.priceOverlay)])
        );

        const productMap = new Map(products.map(p => [p.id, p]));

        for (const item of items) {
            const product = productMap.get(item.productId);

            if (!product) {
                throw new Error(`Product ID ${item.productId} not found`);
            }
            if (!product.isActive) {
                throw new Error(`Product ${product.name} is not active`);
            }

            const price = Number(product.price);
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            // Handle removed ingredients -> append to notes
            const finalNotes = this.buildItemNotes(item, product);

            // SECURITY: Replace frontend prices with DB prices
            const sanitizedModifiers = item.modifiers?.map(m => {
                const dbPrice = modifierPriceMap.get(m.id);
                if (dbPrice === undefined) {
                    throw new Error(`Modifier ID ${m.id} not found`);
                }
                return { id: m.id, price: dbPrice };
            });

            itemDataList.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: price,
                notes: finalNotes || undefined,
                status: 'PENDING',
                modifiers: sanitizedModifiers
            });

            // Calculate modifiers price FROM DATABASE VALUES
            if (sanitizedModifiers && sanitizedModifiers.length > 0) {
                const modsTotal = sanitizedModifiers.reduce((acc, m) => acc + m.price, 0);
                subtotal += modsTotal * item.quantity;
            }

            // Prepare stock updates
            this.calculateStockUpdates(
                item, 
                product, 
                stockUpdates, 
                stockEnabled
            );
        }

        return { itemDataList, stockUpdates, subtotal };
    }

    /**
     * Build item notes including removed ingredients.
     */
    private buildItemNotes(
        item: OrderItemInput, 
        product: { ingredients: { ingredientId: number; ingredient: { name: string } }[] }
    ): string {
        let finalNotes = item.notes || '';
        
        if (item.removedIngredientIds && item.removedIngredientIds.length > 0) {
            const removedNames = product.ingredients
                .filter(pi => item.removedIngredientIds?.includes(pi.ingredientId))
                .map(pi => pi.ingredient.name);
            
            if (removedNames.length > 0) {
                const prefix = finalNotes ? '. ' : '';
                finalNotes += `${prefix}(SIN: ${removedNames.join(', ')})`;
            }
        }
        
        return finalNotes;
    }

    /**
     * Calculate stock updates for an item.
     * Validates stock availability if stockEnabled is true.
     */
    private calculateStockUpdates(
        item: OrderItemInput,
        product: { 
            name: string; 
            isStockable: boolean; 
            ingredients: { 
                ingredientId: number; 
                quantity: any;
                ingredient: { name: string; stock: any } 
            }[] 
        },
        stockUpdates: StockUpdate[],
        stockEnabled: boolean
    ): void {
        if (!product.isStockable || product.ingredients.length === 0) {
            return;
        }

        for (const ing of product.ingredients) {
            // Skip if removed
            if (item.removedIngredientIds?.includes(ing.ingredientId)) {
                continue;
            }

            const requiredQty = Number(ing.quantity) * item.quantity;
            const currentStock = Number(ing.ingredient.stock) || 0;

            // Validate stock availability
            if (stockEnabled && currentStock < requiredQty) {
                throw new InsufficientStockError(
                    product.name,
                    ing.ingredient.name,
                    requiredQty,
                    currentStock
                );
            }

            stockUpdates.push({
                ingredientId: ing.ingredientId,
                quantity: requiredQty
            });
        }
    }
}

export const orderItemService = new OrderItemService();
