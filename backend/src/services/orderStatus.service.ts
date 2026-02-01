/**
 * @fileoverview Order status management with state machine validation.
 * Handles order status transitions and enforces valid state changes.
 * 
 * @module services/orderStatus.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */

import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { kdsService } from './kds.service';
import { auditService } from './audit.service';
import { ValidationError, NotFoundError } from '../utils/errors';

/**
 * Data structure for updating order status.
 */
interface OrderUpdateData {
    status: OrderStatus;
    closedAt?: Date;
}

/**
 * Service for order status transitions.
 * Implements state machine validation to prevent invalid transitions.
 */
export class OrderStatusService {
    
    /**
     * Valid state transitions for order status.
     * Format: { FROM_STATUS: [allowed TO_STATUSES] }
     */
    private readonly allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        [OrderStatus.OPEN]: [OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.OPEN, OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
        [OrderStatus.IN_PREPARATION]: [OrderStatus.OPEN, OrderStatus.PREPARED, OrderStatus.CANCELLED],
        [OrderStatus.PREPARED]: [OrderStatus.OPEN, OrderStatus.IN_PREPARATION, OrderStatus.ON_ROUTE, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.ON_ROUTE]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERED]: [OrderStatus.OPEN], // Can reopen if more items added
        [OrderStatus.CANCELLED]: [] // Terminal state, no transitions allowed
    };

    /**
     * Terminal statuses that close the order.
     */
    private readonly terminalStatuses: OrderStatus[] = [
        OrderStatus.DELIVERED, 
        OrderStatus.CANCELLED
    ];

    /**
     * Update order status and broadcast to KDS.
     * Includes state machine validation to prevent invalid transitions.
     */
    async updateStatus(orderId: number, status: OrderStatus, tenantId: number) {
        // Fetch current order status
        const currentOrder = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            select: { status: true }
        });
        
        if (!currentOrder) {
            throw new NotFoundError(`Order ${orderId}`);
        }

        const currentStatus = currentOrder.status as OrderStatus;
        const allowedNextStatuses = this.allowedTransitions[currentStatus] || [];

        // Validate transition - block invalid state changes
        if (!allowedNextStatuses.includes(status)) {
            throw new ValidationError(
                `Invalid order status transition from ${currentStatus} to ${status}. ` +
                `Allowed transitions: ${allowedNextStatuses.join(', ')}`
            );
        }

        // Build update data
        const updateData: OrderUpdateData = { status };
        
        // Auto-close order if terminal status
        if (this.terminalStatuses.includes(status)) {
            updateData.closedAt = new Date();
        }

        // If status is PREPARED (Ready), mark all non-served items as READY
        if (status === OrderStatus.PREPARED) {
            await prisma.orderItem.updateMany({
                where: {
                    orderId,
                    tenantId,
                    status: { notIn: ['SERVED', 'READY'] }
                },
                data: { status: 'READY' }
            });
        }

        // Use updateMany with tenantId for defense-in-depth (P1-008 fix)
        const updateResult = await prisma.order.updateMany({
            where: { id: orderId, tenantId },
            data: updateData
        });
        if (updateResult.count === 0) {
            throw new NotFoundError(`Order ${orderId}`);
        }

        // Fetch the updated order with relations for broadcasting
        const order = await prisma.order.findFirstOrThrow({
            where: { id: orderId, tenantId },
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

        // Free the table if order is cancelled and has an associated table
        if (status === OrderStatus.CANCELLED && order.tableId) {
            await prisma.table.updateMany({
                where: { id: order.tableId, tenantId, currentOrderId: orderId },
                data: { status: 'FREE', currentOrderId: null }
            });
        }

        // Broadcast update
        kdsService.broadcastOrderUpdate(order);

        return order;
    }

    /**
     * Check if a status transition is valid.
     */
    isValidTransition(fromStatus: OrderStatus, toStatus: OrderStatus): boolean {
        const allowed = this.allowedTransitions[fromStatus] || [];
        return allowed.includes(toStatus);
    }

    /**
     * Get allowed next statuses for a given status.
     */
    getAllowedTransitions(currentStatus: OrderStatus): OrderStatus[] {
        return this.allowedTransitions[currentStatus] || [];
    }
}

export const orderStatusService = new OrderStatusService();
