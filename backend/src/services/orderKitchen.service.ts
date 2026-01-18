/**
 * @fileoverview Kitchen Display System (KDS) order operations.
 * Handles item status updates and active order queries for kitchen staff.
 * 
 * @module services/orderKitchen.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */

import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { kdsService } from './kds.service';

/**
 * Service for KDS (Kitchen Display System) operations.
 * Manages order item status updates and kitchen order visibility.
 */
export class OrderKitchenService {
    
    /**
     * Update individual order item status.
     * Broadcasts update to KDS clients via WebSocket.
     */
    async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED') {
        const item = await prisma.orderItem.update({
            where: { id: itemId },
            data: { status },
            include: { order: true }
        });

        // Broadcast update via KDS
        const fullOrder = await this.getOrderWithRelations(item.orderId);
        if (fullOrder) {
            kdsService.broadcastOrderUpdate(fullOrder);
        }

        return item;
    }

    /**
     * Mark all items in an order as SERVED.
     * Used when kitchen finishes a table order and waiter picks it up.
     */
    async markAllItemsServed(orderId: number) {
        await prisma.orderItem.updateMany({
            where: { 
                orderId,
                status: { notIn: ['SERVED'] }
            },
            data: { status: 'SERVED' }
        });

        // Fetch and broadcast updated order
        const fullOrder = await this.getOrderWithRelations(orderId);
        if (fullOrder) {
            kdsService.broadcastOrderUpdate(fullOrder);
        }

        return fullOrder;
    }

    /**
     * Get active orders for KDS (Kitchen Display System).
     * Returns orders that are not CLOSED, CANCELLED or DELIVERED.
     * Focuses on orders that need kitchen attention.
     */
    async getActiveOrders() {
        return await prisma.order.findMany({
            where: {
                status: { in: ['OPEN', 'CONFIRMED', 'IN_PREPARATION', 'PREPARED'] as OrderStatus[] },
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
    private async getOrderWithRelations(orderId: number) {
        return await prisma.order.findUnique({
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

export const orderKitchenService = new OrderKitchenService();
