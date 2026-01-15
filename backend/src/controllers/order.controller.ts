
import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { OrderService } from '../services/order.service';
import { OrderChannel, PaymentMethod } from '@prisma/client';

const orderService = new OrderService();

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional()
  })).min(1, "Order must have at least one item"),
  channel: z.nativeEnum(OrderChannel).optional(),
  tableId: z.number().int().optional(),
  clientId: z.number().int().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  payments: z.array(z.object({
      method: z.nativeEnum(PaymentMethod),
      amount: z.number().positive()
  })).optional(),
  deliveryData: z.object({
    address: z.string(),
    notes: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    driverId: z.number().int().optional(),
  }).optional(),
  // serverId will be taken from Auth middleware in req.user
});

import { kdsService } from '../services/kds.service';

export const updateStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Validate status? Zod enum?
        const order = await orderService.updateStatus(Number(id), status);
        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update status' });
    }
};

export const updateItemStatus = async (req: Request, res: Response) => {
    try {
        const { itemId } = req.params;
        const { status } = req.body;
        // TODO: Validate status enum
        const item = await orderService.updateItemStatus(Number(itemId), status);
        res.json({ success: true, data: item });
    } catch (error) {
        console.error("Update Item Status Error", error);
        res.status(500).json({ success: false, error: 'Failed to update item status' });
    }
};

export const getActiveOrders = async (req: Request, res: Response) => {
    try {
        const orders = await orderService.getActiveOrders();
        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch active orders' });
    }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const data = createOrderSchema.parse(req.body);
    
    // Get serverId from authenticated user (typed via express.d.ts)
    const serverId = req.user?.id;

    const orderInput: any = {
      ...data,
      serverId
    };

    const order = await orderService.createOrder(orderInput);

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    console.error(error);
    res.status(500).json({ success: false, error: (error as any).message || 'Failed to create order' });
  }
};

export const getOrders = async (req: Request, res: Response) => {
    try {
        const orders = await orderService.getRecentOrders();
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
};

export const getOrderByTable = async (req: Request, res: Response) => {
    try {
        const tableId = Number(req.params.tableId);
        if (isNaN(tableId)) {
            return res.status(400).json({ success: false, error: 'Invalid table ID' });
        }
        const order = await orderService.getOrderByTable(tableId);
        res.json({ success: true, data: order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
};

const addItemsSchema = z.object({
    items: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        notes: z.string().optional()
    })).min(1, "Must add at least one item")
});

export const addItemsToOrder = async (req: Request, res: Response) => {
    try {
        const orderId = Number(req.params.orderId);
        if (isNaN(orderId)) {
            return res.status(400).json({ success: false, error: 'Invalid order ID' });
        }
        const data = addItemsSchema.parse(req.body);
        const serverId = req.user?.id;

        if (!serverId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const order = await orderService.addItemsToOrder(orderId, data.items as any, serverId);
        res.json({ success: true, data: order });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ success: false, error: error.issues });
        }
        console.error(error);
        res.status(500).json({ success: false, error: (error as any).message || 'Failed to add items' });
    }
};
