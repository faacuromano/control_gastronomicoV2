"use strict";
/**
 * @fileoverview Delivery order operations.
 * Handles driver assignment and delivery order queries.
 *
 * @module services/orderDelivery.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderDeliveryService = exports.OrderDeliveryService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const kds_service_1 = require("./kds.service");
/**
 * Service for delivery-specific order operations.
 * Manages driver assignments and delivery order visibility.
 */
class OrderDeliveryService {
    /**
     * Assign a driver to an order.
     * Does not change order status - use OrderStatusService for that.
     */
    async assignDriver(orderId, driverId) {
        const order = await prisma_1.prisma.order.update({
            where: { id: orderId },
            data: { driverId },
            include: {
                driver: true,
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                }
            }
        });
        // Broadcast update
        kds_service_1.kdsService.broadcastOrderUpdate(order);
        return order;
    }
    /**
     * Get active delivery orders (including delivered orders from today).
     * Used by delivery dashboard to display pending and recent deliveries.
     */
    async getDeliveryOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeDeliveryStatuses = [
            client_1.OrderStatus.OPEN,
            client_1.OrderStatus.CONFIRMED,
            client_1.OrderStatus.IN_PREPARATION,
            client_1.OrderStatus.PREPARED,
            client_1.OrderStatus.ON_ROUTE
        ];
        return await prisma_1.prisma.order.findMany({
            where: {
                // FIX: Only show orders with actual delivery fulfillment types
                // This excludes POS and DINE_IN orders from the delivery dashboard
                fulfillmentType: { in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY', 'TAKEAWAY'] },
                OR: [
                    { status: { in: activeDeliveryStatuses } },
                    {
                        status: client_1.OrderStatus.DELIVERED,
                        closedAt: { gte: today }
                    }
                ]
            },
            include: {
                items: { include: { product: true, modifiers: { include: { modifierOption: true } } } },
                client: true,
                driver: true
            },
            orderBy: { createdAt: 'asc' }
        });
    }
}
exports.OrderDeliveryService = OrderDeliveryService;
exports.orderDeliveryService = new OrderDeliveryService();
//# sourceMappingURL=orderDelivery.service.js.map