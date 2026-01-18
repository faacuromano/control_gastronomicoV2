"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/orders', auth_1.authenticateToken, order_controller_1.getDeliveryOrders); // /api/v1/delivery/orders
router.patch('/:id/assign', auth_1.authenticateToken, order_controller_1.assignDriver); // /api/v1/delivery/:id/assign
exports.default = router;
//# sourceMappingURL=delivery.routes.js.map