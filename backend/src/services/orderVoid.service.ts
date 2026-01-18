/**
 * @fileoverview Order item void/cancel service.
 * Handles item voiding with stock reversal and audit logging.
 * 
 * @module services/orderVoid.service
 * @phase2 Operational Features
 */

import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, AuditAction } from '@prisma/client';
import { StockMovementService } from './stockMovement.service';
import { auditService, AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

const stockService = new StockMovementService();

/**
 * Valid reasons for voiding an item.
 */
export const VOID_REASONS = [
    'CUSTOMER_CHANGED_MIND',
    'WRONG_ITEM',
    'QUALITY_ISSUE',
    'OUT_OF_STOCK',
    'KITCHEN_ERROR',
    'DUPLICATE_ENTRY',
    'OTHER'
] as const;

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
export class OrderVoidService {
    
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
    async voidItem(input: VoidItemInput, context: AuditContext): Promise<VoidItemResult> {
        // Validate reason
        if (!VOID_REASONS.includes(input.reason)) {
            throw new ValidationError(`Invalid void reason: ${input.reason}`);
        }
        
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get the item with product and order info
            const item = await tx.orderItem.findUnique({
                where: { id: input.orderItemId },
                include: {
                    product: {
                        include: {
                            ingredients: {
                                include: { ingredient: true }
                            }
                        }
                    },
                    modifiers: true,
                    order: true
                }
            });
            
            if (!item) {
                throw new NotFoundError('OrderItem');
            }
            
            // 2. Check if order is still modifiable
            if (item.order.paymentStatus === 'PAID') {
                throw new ValidationError('Cannot void items from a paid order');
            }
            
            // 3. Calculate item value being removed
            const itemPrice = Number(item.unitPrice) * item.quantity;
            const modifiersPrice = item.modifiers.reduce(
                (sum, m) => sum + Number(m.priceCharged), 
                0
            ) * item.quantity;
            const totalRemoved = itemPrice + modifiersPrice;
            
            // 4. Reverse stock if product is stockable
            let stockReversed = false;
            if (item.product.isStockable && item.product.ingredients.length > 0) {
                for (const ing of item.product.ingredients) {
                    const qtyToRestore = Number(ing.quantity) * item.quantity;
                    await stockService.register(
                        ing.ingredientId,
                        StockMoveType.ADJUSTMENT, // Use ADJUSTMENT for reversal
                        qtyToRestore,
                        `Void item #${item.id} - ${input.reason}`,
                        tx
                    );
                }
                stockReversed = true;
                logger.info('Stock reversed for voided item', {
                    orderItemId: item.id,
                    productId: item.productId,
                    reason: input.reason
                });
            }
            
            // 5. Delete modifiers first, then the item
            await tx.orderItemModifier.deleteMany({
                where: { orderItemId: item.id }
            });
            
            await tx.orderItem.delete({
                where: { id: item.id }
            });
            
            // 6. Recalculate order totals
            const remainingItems = await tx.orderItem.findMany({
                where: { orderId: item.orderId },
                include: { modifiers: true }
            });
            
            let newSubtotal = 0;
            for (const remaining of remainingItems) {
                newSubtotal += Number(remaining.unitPrice) * remaining.quantity;
                for (const mod of remaining.modifiers) {
                    newSubtotal += Number(mod.priceCharged) * remaining.quantity;
                }
            }
            
            await tx.order.update({
                where: { id: item.orderId },
                data: {
                    subtotal: newSubtotal,
                    total: newSubtotal - Number(item.order.discount)
                }
            });
            
            return {
                orderId: item.orderId,
                orderNumber: item.order.orderNumber,
                productName: item.product.name,
                quantity: item.quantity,
                totalRemoved,
                newOrderTotal: newSubtotal - Number(item.order.discount),
                stockReversed
            };
        });
        
        // 7. Log to audit trail (outside transaction for safety)
        await auditService.log(
            AuditAction.ITEM_VOIDED,
            'OrderItem',
            input.orderItemId,
            context,
            {
                orderId: result.orderId,
                orderNumber: result.orderNumber,
                productName: result.productName,
                quantity: result.quantity,
                totalRemoved: result.totalRemoved,
                reason: input.reason,
                notes: input.notes,
                stockReversed: result.stockReversed
            }
        );
        
        logger.info('Order item voided', {
            orderItemId: input.orderItemId,
            orderId: result.orderId,
            reason: input.reason,
            totalRemoved: result.totalRemoved
        });
        
        return {
            success: true,
            orderItemId: input.orderItemId,
            stockReversed: result.stockReversed,
            newOrderTotal: result.newOrderTotal
        };
    }
    
    /**
     * Get available void reasons for UI.
     */
    getVoidReasons(): { code: VoidReason; label: string }[] {
        return [
            { code: 'CUSTOMER_CHANGED_MIND', label: 'Cliente cambió de opinión' },
            { code: 'WRONG_ITEM', label: 'Item incorrecto' },
            { code: 'QUALITY_ISSUE', label: 'Problema de calidad' },
            { code: 'OUT_OF_STOCK', label: 'Sin stock' },
            { code: 'KITCHEN_ERROR', label: 'Error de cocina' },
            { code: 'DUPLICATE_ENTRY', label: 'Entrada duplicada' },
            { code: 'OTHER', label: 'Otro' }
        ];
    }
}

export const orderVoidService = new OrderVoidService();
