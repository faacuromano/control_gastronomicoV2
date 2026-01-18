import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError } from '../utils/errors';

export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getDeliveryOrders();
    res.json({ success: true, data: orders });
});

const assignDriverSchema = z.object({
    driverId: z.number().int().positive()
});

export const assignDriver = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
        throw new ValidationError('Invalid order ID');
    }

    const data = assignDriverSchema.parse(req.body);

    const order = await orderService.assignDriver(orderId, data.driverId);
    res.json({ success: true, data: order });
});
