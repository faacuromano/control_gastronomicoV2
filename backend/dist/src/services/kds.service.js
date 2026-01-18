"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kdsService = exports.KDSService = void 0;
const socket_1 = require("../lib/socket");
const logger_1 = require("../utils/logger");
class KDSService {
    /**
     * Calculate estimated preparation time (in minutes)
     */
    calculatePrepTime(items) {
        // Base time (10m) + 2m per item
        // Future: Fetch specific times from DB
        return 10 + (items.length * 2);
    }
    /**
     * Broadcasts a new order to the Kitchen
     */
    broadcastNewOrder(order) {
        try {
            const io = (0, socket_1.getIO)();
            const prepTime = this.calculatePrepTime(order.items || []);
            const payload = {
                ...order,
                estimatedPrepTime: prepTime,
                timestamp: new Date()
            };
            // 1. Notify General Kitchen
            io.to('kitchen').emit('kitchen:order_new', payload);
            // 2. Notify Legacy event (for backward compatibility if needed)
            io.to('kitchen').emit('order:new', payload);
            logger_1.logger.info('Broadcasted new order to kitchen', {
                orderNumber: order.orderNumber,
                prepTime
            });
        }
        catch (error) {
            logger_1.logger.warn('Failed to broadcast new order', { error });
        }
    }
    /**
     * Broadcasts an order update
     */
    broadcastOrderUpdate(order) {
        try {
            const io = (0, socket_1.getIO)();
            // Notify Kitchen
            io.to('kitchen').emit('kitchen:order_update', order);
            io.to('kitchen').emit('order:update', order); // Legacy
            // If PREPARED and has tableId, notify Waiters that order is ready for pickup
            if (order.status === 'PREPARED' && order.tableId) {
                io.to('waiters').emit('waiter:order_ready', {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    tableId: order.tableId
                });
            }
            logger_1.logger.info('Broadcasted order update', {
                orderNumber: order.orderNumber,
                status: order.status
            });
        }
        catch (error) {
            logger_1.logger.warn('Failed to broadcast order update', { error });
        }
    }
    /**
     * Send generic alert to kitchen
     */
    sendAlert(message, level = 'INFO') {
        try {
            const io = (0, socket_1.getIO)();
            io.to('kitchen').emit('kitchen:alert', { message, level, timestamp: new Date() });
        }
        catch (error) {
            logger_1.logger.warn('Failed to send alert', { error });
        }
    }
}
exports.KDSService = KDSService;
exports.kdsService = new KDSService();
//# sourceMappingURL=kds.service.js.map