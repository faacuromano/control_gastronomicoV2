import { getIO } from '../lib/socket';
import { logger } from '../utils/logger';

export class KDSService {
    /**
     * Calculate estimated preparation time (in minutes)
     */
    calculatePrepTime(items: any[]): number {
        // Base time (10m) + 2m per item
        // Future: Fetch specific times from DB
        return 10 + (items.length * 2);
    }

    /**
     * Broadcasts a new order to the Kitchen (tenant-scoped).
     * The order object MUST include tenantId.
     */
    broadcastNewOrder(order: any) {
        try {
            const io = getIO();
            if (!io) return;

            if (!order.tenantId) {
                logger.error('broadcastNewOrder called without tenantId on order', { orderId: order.id });
                return;
            }

            const tenantId = order.tenantId;
            const prepTime = this.calculatePrepTime(order.items || []);

            const payload = {
                ...order,
                estimatedPrepTime: prepTime,
                timestamp: new Date()
            };

            // 1. Notify General Kitchen (tenant-scoped)
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_new', payload);

            // 2. Notify Legacy event (for backward compatibility if needed)
            io.to(`tenant:${tenantId}:kitchen`).emit('order:new', payload);

            logger.info('Broadcasted new order to kitchen', {
                orderNumber: order.orderNumber,
                tenantId,
                prepTime
            });
        } catch (error) {
            logger.warn('Failed to broadcast new order', { error });
        }
    }

    /**
     * Broadcasts an order update (tenant-scoped).
     * The order object MUST include tenantId.
     */
    broadcastOrderUpdate(order: any) {
        try {
            const io = getIO();
            if (!io) return;

            if (!order.tenantId) {
                logger.error('broadcastOrderUpdate called without tenantId on order', { orderId: order.id });
                return;
            }

            const tenantId = order.tenantId;

            // Notify Kitchen (tenant-scoped)
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_update', order);
            io.to(`tenant:${tenantId}:kitchen`).emit('order:update', order); // Legacy

            // If PREPARED and has tableId, notify Waiters that order is ready for pickup
            if (order.status === 'PREPARED' && order.tableId) {
                io.to(`tenant:${tenantId}:waiters`).emit('waiter:order_ready', {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    tableId: order.tableId
                });
            }

            logger.info('Broadcasted order update', {
                orderNumber: order.orderNumber,
                status: order.status,
                tenantId
            });
        } catch (error) {
            logger.warn('Failed to broadcast order update', { error });
        }
    }

    /**
     * Send generic alert to kitchen (tenant-scoped).
     */
    sendAlert(tenantId: number, message: string, level: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') {
        try {
            const io = getIO();
            if (!io) return;
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:alert', { message, level, timestamp: new Date() });
        } catch (error) {
            logger.warn('Failed to send alert', { error });
        }
    }
}

export const kdsService = new KDSService();
