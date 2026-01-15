import { Router } from 'express';
import { getDeliveryOrders, assignDriver } from '../controllers/delivery.controller';
import { authenticate } from '../middleware/auth'; 
// Assuming auth required for these operations

const router = Router();

router.get('/orders', authenticate, getDeliveryOrders); // /api/v1/delivery/orders
router.patch('/:id/assign', authenticate, assignDriver); // /api/v1/delivery/:id/assign

export default router;
