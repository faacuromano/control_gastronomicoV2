import { Router } from 'express';
import * as OrderController from '../controllers/order.controller';
import { authenticateToken as authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Routes are relative to /api/v1/orders (where this router is mounted)

// Create order - requires orders:create
router.post('/', requirePermission('orders', 'create'), OrderController.createOrder);

// Read orders - requires orders:read
router.get('/', requirePermission('orders', 'read'), OrderController.getOrders);
router.get('/table/:tableId', requirePermission('orders', 'read'), OrderController.getOrderByTable);
router.get('/kds', requirePermission('orders', 'read'), OrderController.getActiveOrders);

// Update order status - requires orders:update
router.patch('/:id/status', requirePermission('orders', 'update'), OrderController.updateStatus);
router.patch('/items/:itemId/status', requirePermission('orders', 'update'), OrderController.updateItemStatus);
router.post('/:orderId/items', requirePermission('orders', 'update'), OrderController.addItemsToOrder);
router.post('/:orderId/items/served', requirePermission('orders', 'update'), OrderController.markAllItemsServed);

// Void/Cancel items - requires orders:delete (manager action)
router.delete('/items/:itemId/void', requirePermission('orders', 'delete'), OrderController.voidItem);
router.get('/void-reasons', requirePermission('orders', 'read'), OrderController.getVoidReasons);

// Transfer items between tables - requires orders:update
router.post('/items/transfer', requirePermission('orders', 'update'), OrderController.transferItems);

export default router;

