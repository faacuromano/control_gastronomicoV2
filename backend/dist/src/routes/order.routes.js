"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Routes are relative to /api/v1/orders (where this router is mounted)
router.post('/', order_controller_1.createOrder);
router.get('/', order_controller_1.getOrders);
exports.default = router;
//# sourceMappingURL=order.routes.js.map