"use strict";
/**
 * @fileoverview Order item transfer service.
 * Handles moving items between tables with audit logging.
 *
 * @module services/orderTransfer.service
 * @phase2 Operational Features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderTransferService = exports.OrderTransferService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const businessDate_1 = require("../utils/businessDate");
/**
 * Service for transferring order items between tables.
 */
class OrderTransferService {
    /**
     * Transfer items from one table to another.
     *
     * If target table has an open order, items are added to it.
     * If not, a new order is created for the target table.
     *
     * @param itemIds - IDs of items to transfer
     * @param fromTableId - Source table ID
     * @param toTableId - Target table ID
     * @param context - Audit context
     */
    async transferItems(itemIds, fromTableId, toTableId, context) {
        if (fromTableId === toTableId) {
            throw new errors_1.ValidationError('Cannot transfer items to the same table');
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Get source table and its current order (open/confirmed)
            const fromTable = await tx.table.findUnique({
                where: { id: fromTableId },
                include: {
                    orders: {
                        where: { status: { in: ['OPEN', 'CONFIRMED'] } },
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
            const sourceOrder = fromTable?.orders[0];
            if (!sourceOrder) {
                throw new errors_1.ValidationError('Source table has no open order');
            }
            // 2. Validate items belong to source order
            const items = await tx.orderItem.findMany({
                where: {
                    id: { in: itemIds },
                    orderId: sourceOrder.id
                },
                include: { modifiers: true }
            });
            if (items.length !== itemIds.length) {
                throw new errors_1.ValidationError('Some items do not belong to the source order');
            }
            // 3. Get or create target order
            const toTable = await tx.table.findUnique({
                where: { id: toTableId },
                include: {
                    orders: {
                        where: { status: { in: ['OPEN', 'CONFIRMED'] } },
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
            if (!toTable) {
                throw new errors_1.NotFoundError('Target table');
            }
            const targetOrder = toTable.orders[0];
            let targetOrderId;
            let newOrderCreated = false;
            if (targetOrder) {
                // Add to existing order
                targetOrderId = targetOrder.id;
            }
            else {
                // Create new order for target table
                const newOrder = await tx.order.create({
                    data: {
                        orderNumber: 0, // Will be assigned
                        channel: sourceOrder.channel,
                        status: 'OPEN',
                        paymentStatus: 'PENDING',
                        subtotal: 0,
                        total: 0,
                        businessDate: (0, businessDate_1.getBusinessDate)(), // FIX P1-001: Use 6 AM cutoff logic
                        tableId: toTableId,
                        serverId: sourceOrder.serverId
                    }
                });
                targetOrderId = newOrder.id;
                newOrderCreated = true;
                // Update target table
                await tx.table.update({
                    where: { id: toTableId },
                    data: {
                        status: 'OCCUPIED',
                        currentOrderId: newOrder.id
                    }
                });
            }
            // 4. Move items to target order
            await tx.orderItem.updateMany({
                where: { id: { in: itemIds } },
                data: { orderId: targetOrderId }
            });
            // 5. Recalculate source order totals
            const remainingSourceItems = await tx.orderItem.findMany({
                where: { orderId: sourceOrder.id },
                include: { modifiers: true }
            });
            let sourceSubtotal = 0;
            for (const item of remainingSourceItems) {
                sourceSubtotal += Number(item.unitPrice) * item.quantity;
                for (const mod of item.modifiers) {
                    sourceSubtotal += Number(mod.priceCharged) * item.quantity;
                }
            }
            await tx.order.update({
                where: { id: sourceOrder.id },
                data: {
                    subtotal: sourceSubtotal,
                    total: sourceSubtotal - Number(sourceOrder.discount)
                }
            });
            // If source order has no items left, close it
            if (remainingSourceItems.length === 0) {
                await tx.order.update({
                    where: { id: sourceOrder.id },
                    data: { status: 'CANCELLED' }
                });
                await tx.table.update({
                    where: { id: fromTableId },
                    data: { status: 'FREE', currentOrderId: null }
                });
            }
            // 6. Recalculate target order totals
            const targetItems = await tx.orderItem.findMany({
                where: { orderId: targetOrderId },
                include: { modifiers: true }
            });
            let targetSubtotal = 0;
            for (const item of targetItems) {
                targetSubtotal += Number(item.unitPrice) * item.quantity;
                for (const mod of item.modifiers) {
                    targetSubtotal += Number(mod.priceCharged) * item.quantity;
                }
            }
            await tx.order.update({
                where: { id: targetOrderId },
                data: {
                    subtotal: targetSubtotal,
                    total: targetSubtotal
                }
            });
            return {
                fromOrderId: sourceOrder.id,
                toOrderId: targetOrderId,
                newOrderCreated,
                itemCount: items.length,
                itemDetails: items.map(i => ({
                    id: i.id,
                    productId: i.productId,
                    quantity: i.quantity
                }))
            };
        });
        // 7. Log to audit trail
        await audit_service_1.auditService.log(client_1.AuditAction.ITEM_TRANSFERRED, 'OrderItem', null, // Multiple items
        context, {
            itemIds,
            fromTableId,
            toTableId,
            fromOrderId: result.fromOrderId,
            toOrderId: result.toOrderId,
            newOrderCreated: result.newOrderCreated,
            itemCount: result.itemCount
        });
        logger_1.logger.info('Items transferred between tables', {
            itemIds,
            fromTableId,
            toTableId,
            itemCount: result.itemCount
        });
        return {
            success: true,
            itemsTransferred: result.itemCount,
            fromOrderId: result.fromOrderId,
            toOrderId: result.toOrderId,
            newOrderCreated: result.newOrderCreated
        };
    }
}
exports.OrderTransferService = OrderTransferService;
exports.orderTransferService = new OrderTransferService();
//# sourceMappingURL=orderTransfer.service.js.map