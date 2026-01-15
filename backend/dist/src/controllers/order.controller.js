"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrders = exports.createOrder = void 0;
const zod_1 = require("zod");
const order_service_1 = require("../services/order.service");
const client_1 = require("@prisma/client");
const orderService = new order_service_1.OrderService();
const createOrderSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().optional()
    })).min(1, "Order must have at least one item"),
    channel: zod_1.z.nativeEnum(client_1.OrderChannel).optional(),
    tableId: zod_1.z.number().int().optional(),
    clientId: zod_1.z.number().int().optional(),
    paymentMethod: zod_1.z.nativeEnum(client_1.PaymentMethod).optional(),
    // serverId will be taken from Auth middleware in req.user
});
const createOrder = async (req, res) => {
    try {
        const data = createOrderSchema.parse(req.body);
        // Get serverId from authenticated user (typed via express.d.ts)
        const serverId = req.user?.id;
        const orderInput = {
            ...data,
            serverId
        };
        const order = await orderService.createOrder(orderInput);
        res.status(201).json({ success: true, data: order });
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ success: false, error: error.issues });
        }
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create order' });
    }
};
exports.createOrder = createOrder;
const getOrders = async (req, res) => {
    try {
        const orders = await orderService.getRecentOrders();
        res.json({ success: true, data: orders });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
};
exports.getOrders = getOrders;
//# sourceMappingURL=order.controller.js.map