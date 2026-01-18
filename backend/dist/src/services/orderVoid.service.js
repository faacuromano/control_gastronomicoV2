"use strict";
/**
 * @fileoverview Order item void/cancel service.
 * Handles item voiding with stock reversal and audit logging.
 *
 * @module services/orderVoid.service
 * @phase2 Operational Features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderVoidService = exports.OrderVoidService = exports.VOID_REASONS = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const stockMovement_service_1 = require("./stockMovement.service");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const stockService = new stockMovement_service_1.StockMovementService();
/**
 * Valid reasons for voiding an item.
 */
exports.VOID_REASONS = [
    'CUSTOMER_CHANGED_MIND',
    'WRONG_ITEM',
    'QUALITY_ISSUE',
    'OUT_OF_STOCK',
    'KITCHEN_ERROR',
    'DUPLICATE_ENTRY',
    'OTHER'
];
/**
 * Service for voiding/cancelling order items.
 */
class OrderVoidService {
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
    async voidItem(input, context) {
        // Validate reason
        if (!exports.VOID_REASONS.includes(input.reason)) {
            throw new errors_1.ValidationError(`Invalid void reason: ${input.reason}`);
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
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
                throw new errors_1.NotFoundError('OrderItem');
            }
            // 2. Check if order is still modifiable
            if (item.order.paymentStatus === 'PAID') {
                throw new errors_1.ValidationError('Cannot void items from a paid order');
            }
            // 3. Calculate item value being removed
            const itemPrice = Number(item.unitPrice) * item.quantity;
            const modifiersPrice = item.modifiers.reduce((sum, m) => sum + Number(m.priceCharged), 0) * item.quantity;
            const totalRemoved = itemPrice + modifiersPrice;
            // 4. Reverse stock if product is stockable
            let stockReversed = false;
            if (item.product.isStockable && item.product.ingredients.length > 0) {
                for (const ing of item.product.ingredients) {
                    const qtyToRestore = Number(ing.quantity) * item.quantity;
                    await stockService.register(ing.ingredientId, client_1.StockMoveType.ADJUSTMENT, // Use ADJUSTMENT for reversal
                    qtyToRestore, `Void item #${item.id} - ${input.reason}`, tx);
                }
                stockReversed = true;
                logger_1.logger.info('Stock reversed for voided item', {
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
        await audit_service_1.auditService.log(client_1.AuditAction.ITEM_VOIDED, 'OrderItem', input.orderItemId, context, {
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            productName: result.productName,
            quantity: result.quantity,
            totalRemoved: result.totalRemoved,
            reason: input.reason,
            notes: input.notes,
            stockReversed: result.stockReversed
        });
        logger_1.logger.info('Order item voided', {
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
    getVoidReasons() {
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
exports.OrderVoidService = OrderVoidService;
exports.orderVoidService = new OrderVoidService();
//# sourceMappingURL=orderVoid.service.js.map