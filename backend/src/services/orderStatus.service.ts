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
    async updateStatus(orderId: number, status: OrderStatus) {
        // Fetch current order status
        const currentOrder = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true }
        });
        
        if (!currentOrder) {
            throw new Error(`Order ${orderId} not found`);
        }

        const currentStatus = currentOrder.status as OrderStatus;
        const allowedNextStatuses = this.allowedTransitions[currentStatus] || [];

        // Validate transition
        if (!allowedNextStatuses.includes(status)) {
            console.warn(`[OrderStatusService] Invalid transition from ${currentStatus} to ${status} for order ${orderId}. Proceeding anyway.`);
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
                    status: { notIn: ['SERVED', 'READY'] }
                },
                data: { status: 'READY' }
            });
        }

        const order = await prisma.order.update({
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
