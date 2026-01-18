"use strict";
/**
 * @fileoverview Kitchen Display System (KDS) order operations.
 * Handles item status updates and active order queries for kitchen staff.
 *
 * @module services/orderKitchen.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderKitchenService = exports.OrderKitchenService = void 0;
const prisma_1 = require("../lib/prisma");
const kds_service_1 = require("./kds.service");
/**
 * Service for KDS (Kitchen Display System) operations.
 * Manages order item status updates and kitchen order visibility.
 */
class OrderKitchenService {
    /**
     * Update individual order item status.
     * Broadcasts update to KDS clients via WebSocket.
     */
    async updateItemStatus(itemId, status) {
        const item = await prisma_1.prisma.orderItem.update({
            where: { id: itemId },
            data: { status },
            include: { order: true }
        });
        // Broadcast update via KDS
        const fullOrder = await this.getOrderWithRelations(item.orderId);
        if (fullOrder) {
            kds_service_1.kdsService.broadcastOrderUpdate(fullOrder);
        }
        return item;
    }
    /**
     * Mark all items in an order as SERVED.
     * Used when kitchen finishes a table order and waiter picks it up.
     */
    async markAllItemsServed(orderId) {
        await prisma_1.prisma.orderItem.updateMany({
            where: {
                orderId,
                status: { notIn: ['SERVED'] }
            },
            data: { status: 'SERVED' }
        });
        // Fetch and broadcast updated order
        const fullOrder = await this.getOrderWithRelations(orderId);
        if (fullOrder) {
            kds_service_1.kdsService.broadcastOrderUpdate(fullOrder);
        }
        return fullOrder;
    }
    /**
     * Get active orders for KDS (Kitchen Display System).
     * Returns orders that are not CLOSED, CANCELLED or DELIVERED.
     * Focuses on orders that need kitchen attention.
     */
    async getActiveOrders() {
        return await prisma_1.prisma.order.findMany({
            where: {
                status: { in: ['OPEN', 'CONFIRMED', 'IN_PREPARATION', 'PREPARED'] },
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)) // From today
                }
            },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    },
                    where: { status: { not: 'SERVED' } }
                },
                table: true
            },
            orderBy: { createdAt: 'asc' }
        });
    }
    /**
     * Helper to get order with full relations for broadcasting.
     * @private
     */
    async getOrderWithRelations(orderId) {
        return await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                payments: true,
                client: true,
                driver: true
            }
        });
    }
}
exports.OrderKitchenService = OrderKitchenService;
exports.orderKitchenService = new OrderKitchenService();
//# sourceMappingURL=orderKitchen.service.js.map