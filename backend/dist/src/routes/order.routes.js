"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const OrderController = __importStar(require("../controllers/order.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Routes are relative to /api/v1/orders (where this router is mounted)
// Create order - requires orders:create
router.post('/', (0, auth_1.requirePermission)('orders', 'create'), OrderController.createOrder);
// Read orders - requires orders:read
router.get('/', (0, auth_1.requirePermission)('orders', 'read'), OrderController.getOrders);
router.get('/table/:tableId', (0, auth_1.requirePermission)('orders', 'read'), OrderController.getOrderByTable);
router.get('/kds', (0, auth_1.requirePermission)('orders', 'read'), OrderController.getActiveOrders);
// Update order status - requires orders:update
router.patch('/:id/status', (0, auth_1.requirePermission)('orders', 'update'), OrderController.updateStatus);
router.patch('/items/:itemId/status', (0, auth_1.requirePermission)('orders', 'update'), OrderController.updateItemStatus);
router.post('/:orderId/items', (0, auth_1.requirePermission)('orders', 'update'), OrderController.addItemsToOrder);
router.post('/:orderId/items/served', (0, auth_1.requirePermission)('orders', 'update'), OrderController.markAllItemsServed);
// Void/Cancel items - requires orders:delete (manager action)
router.delete('/items/:itemId/void', (0, auth_1.requirePermission)('orders', 'delete'), OrderController.voidItem);
router.get('/void-reasons', (0, auth_1.requirePermission)('orders', 'read'), OrderController.getVoidReasons);
// Transfer items between tables - requires orders:update
router.post('/items/transfer', (0, auth_1.requirePermission)('orders', 'update'), OrderController.transferItems);
exports.default = router;
//# sourceMappingURL=order.routes.js.map