"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignDriver = exports.getDeliveryOrders = void 0;
const order_service_1 = require("../services/order.service");
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errors_1 = require("../utils/errors");
exports.getDeliveryOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orders = await order_service_1.orderService.getDeliveryOrders();
    res.json({ success: true, data: orders });
});
const assignDriverSchema = zod_1.z.object({
    driverId: zod_1.z.number().int().positive()
});
exports.assignDriver = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
        throw new errors_1.ValidationError('Invalid order ID');
    }
    const data = assignDriverSchema.parse(req.body);
    const order = await order_service_1.orderService.assignDriver(orderId, data.driverId);
    res.json({ success: true, data: order });
});
//# sourceMappingURL=delivery.controller.js.map