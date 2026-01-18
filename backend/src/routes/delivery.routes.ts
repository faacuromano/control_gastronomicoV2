import { Router } from 'express';
import { getDeliveryOrders, assignDriver } from '../controllers/order.controller';
import { authenticateToken as authenticate } from '../middleware/auth'; 

const router = Router();

router.get('/orders', authenticate, getDeliveryOrders); // /api/v1/delivery/orders
router.patch('/:id/assign', authenticate, assignDriver); // /api/v1/delivery/:id/assign

export default router;
