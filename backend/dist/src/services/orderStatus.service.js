"use strict";
/**
 * @fileoverview Order status management with state machine validation.
 * Handles order status transitions and enforces valid state changes.
 *
 * @module services/orderStatus.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderStatusService = exports.OrderStatusService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const kds_service_1 = require("./kds.service");
/**
 * Service for order status transitions.
 * Implements state machine validation to prevent invalid transitions.
 */
class OrderStatusService {
    /**
     * Valid state transitions for order status.
     * Format: { FROM_STATUS: [allowed TO_STATUSES] }
     */
    allowedTransitions = {
        [client_1.OrderStatus.OPEN]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.IN_PREPARATION, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.CONFIRMED]: [client_1.OrderStatus.OPEN, client_1.OrderStatus.IN_PREPARATION, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.IN_PREPARATION]: [client_1.OrderStatus.OPEN, client_1.OrderStatus.PREPARED, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.PREPARED]: [client_1.OrderStatus.OPEN, client_1.OrderStatus.IN_PREPARATION, client_1.OrderStatus.ON_ROUTE, client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.ON_ROUTE]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.DELIVERED]: [client_1.OrderStatus.OPEN], // Can reopen if more items added
        [client_1.OrderStatus.CANCELLED]: [] // Terminal state, no transitions allowed
    };
    /**
     * Terminal statuses that close the order.
     */
    terminalStatuses = [
        client_1.OrderStatus.DELIVERED,
        client_1.OrderStatus.CANCELLED
    ];
    /**
     * Update order status and broadcast to KDS.
     * Includes state machine validation to prevent invalid transitions.
     */
    async updateStatus(orderId, status) {
        // Fetch current order status
        const currentOrder = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true }
        });
        if (!currentOrder) {
            throw new Error(`Order ${orderId} not found`);
        }
        const currentStatus = currentOrder.status;
        const allowedNextStatuses = this.allowedTransitions[currentStatus] || [];
        // Validate transition
        if (!allowedNextStatuses.includes(status)) {
            console.warn(`[OrderStatusService] Invalid transition from ${currentStatus} to ${status} for order ${orderId}. Proceeding anyway.`);
        }
        // Build update data
        const updateData = { status };
        // Auto-close order if terminal status
        if (this.terminalStatuses.includes(status)) {
            updateData.closedAt = new Date();
        }
        // If status is PREPARED (Ready), mark all non-served items as READY
        if (status === client_1.OrderStatus.PREPARED) {
            await prisma_1.prisma.orderItem.updateMany({
                where: {
                    orderId,
                    status: { notIn: ['SERVED', 'READY'] }
                },
                data: { status: 'READY' }
            });
        }
        const order = await prisma_1.prisma.order.update({
            where: { id: orderId },
            data: updateData,
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                table: true
            }
        });
        // Broadcast update
        kds_service_1.kdsService.broadcastOrderUpdate(order);
        return order;
    }
    /**
     * Check if a status transition is valid.
     */
    isValidTransition(fromStatus, toStatus) {
        const allowed = this.allowedTransitions[fromStatus] || [];
        return allowed.includes(toStatus);
    }
    /**
     * Get allowed next statuses for a given status.
     */
    getAllowedTransitions(currentStatus) {
        return this.allowedTransitions[currentStatus] || [];
    }
}
exports.OrderStatusService = OrderStatusService;
exports.orderStatusService = new OrderStatusService();
//# sourceMappingURL=orderStatus.service.js.map