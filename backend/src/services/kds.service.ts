import { getIO } from '../lib/socket';
import { logger } from '../utils/logger';

export class KDSService {
    /**
     * Broadcasts a new order to the Kitchen
     */
    broadcastNewOrder(order: any) {
        try {
            const io = getIO();
            // Emit to everyone or specifically to 'kitchen' room
            io.to('kitchen').emit('order:new', order);
            logger.info('Broadcasted new order to kitchen', { orderNumber: order.orderNumber });
        } catch (error) {
            logger.warn('Failed to broadcast new order (Socket not initialized?)', { error });
        }
    }

    /**
     * Broadcasts an order update (status change)
     */
    broadcastOrderUpdate(order: any) {
        try {
            const io = getIO();
            io.to('kitchen').emit('order:update', order);
            logger.info('Broadcasted order update to kitchen', { orderNumber: order.orderNumber });
        } catch (error) {
            logger.warn('Failed to broadcast order update', { error });
        }
    }
}

export const kdsService = new KDSService();
