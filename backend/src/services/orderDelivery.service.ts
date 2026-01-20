/**
 * @fileoverview Delivery order operations.
 * Handles driver assignment and delivery order queries.
 * 
 * @module services/orderDelivery.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */

import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { kdsService } from './kds.service';

/**
 * Service for delivery-specific order operations.
 * Manages driver assignments and delivery order visibility.
 */
export class OrderDeliveryService {
    
    /**
     * Assign a driver to an order.
     * Does not change order status - use OrderStatusService for that.
     */
    async assignDriver(orderId: number, driverId: number) {
        const order = await prisma.order.update({
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
        kdsService.broadcastOrderUpdate(order);
        
        return order;
    }

    /**
     * Get active delivery orders (including delivered orders from today).
     * Used by delivery dashboard to display pending and recent deliveries.
     */
    async getDeliveryOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeDeliveryStatuses: OrderStatus[] = [
            OrderStatus.OPEN, 
            OrderStatus.CONFIRMED, 
            OrderStatus.IN_PREPARATION,
            OrderStatus.PREPARED, 
            OrderStatus.ON_ROUTE
        ];

        return await prisma.order.findMany({
            where: {
                // FIX: Only show orders with actual delivery fulfillment types
                // This excludes POS and DINE_IN orders from the delivery dashboard
                fulfillmentType: { in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY', 'TAKEAWAY'] },
                OR: [
                    { status: { in: activeDeliveryStatuses } },
                    { 
                        status: OrderStatus.DELIVERED,
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

export const orderDeliveryService = new OrderDeliveryService();
