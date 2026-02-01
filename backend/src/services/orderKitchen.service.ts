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
import { NotFoundError } from '../utils/errors';

/**
 * Service for KDS (Kitchen Display System) operations.
 * Manages order item status updates and kitchen order visibility.
 */
export class OrderKitchenService {
    
    /**
     * Update individual order item status.
     * Broadcasts update to KDS clients via WebSocket.
     */
    async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED', tenantId: number) {
        // Verify item belongs to tenant before updating
        const existing = await prisma.orderItem.findFirst({
            where: { id: itemId, tenantId }
        });
        if (!existing) throw new NotFoundError('Order item');

        // SAFE: findFirst at L25 verifies tenant ownership before update
        const item = await prisma.orderItem.update({
            where: { id: itemId },
            data: { status },
            include: { order: true }
        });

        // Broadcast update via KDS
        const fullOrder = await this.getOrderWithRelations(item.orderId, tenantId);
        if (fullOrder) {
            kdsService.broadcastOrderUpdate(fullOrder);
        }

        return item;
    }

    /**
     * Mark all items in an order as SERVED.
     * Used when kitchen finishes a table order and waiter picks it up.
     */
    async markAllItemsServed(orderId: number, tenantId: number) {
        // Verify order belongs to tenant
        const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
        if (!order) throw new NotFoundError('Order');

        await prisma.orderItem.updateMany({
            where: {
                orderId,
                tenantId,
                status: { notIn: ['SERVED'] }
            },
            data: { status: 'SERVED' }
        });

        // Fetch and broadcast updated order
        const fullOrder = await this.getOrderWithRelations(orderId, tenantId);
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
    async getActiveOrders(tenantId: number) {
        return await prisma.order.findMany({
            where: {
                tenantId,
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
    private async getOrderWithRelations(orderId: number, tenantId: number) {
        return await prisma.order.findFirst({
            where: { id: orderId, tenantId },
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
