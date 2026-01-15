import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { z } from 'zod';

export const getDeliveryOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orders = await orderService.getDeliveryOrders();
        res.json({ success: true, data: orders });
    } catch (error) {
        next(error);
    }
};

const assignDriverSchema = z.object({
    driverId: z.number().int().positive()
});

export const assignDriver = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orderId = Number(req.params.id);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }

        const data = assignDriverSchema.parse(req.body);

        const order = await orderService.assignDriver(orderId, data.driverId);
        res.json({ success: true, data: order });
    } catch (error) {
        next(error);
    }
};
