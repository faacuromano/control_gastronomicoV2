import { Router } from 'express';
import * as OrderController from '../controllers/order.controller';

import { authenticateToken as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Routes are relative to /api/v1/orders (where this router is mounted)
router.post('/', OrderController.createOrder);
router.get('/', OrderController.getOrders);
router.get('/table/:tableId', OrderController.getOrderByTable);
router.get('/kds', OrderController.getActiveOrders);
router.patch('/:id/status', OrderController.updateStatus);
router.patch('/items/:itemId/status', OrderController.updateItemStatus);
router.post('/:orderId/items', OrderController.addItemsToOrder);

export default router;
