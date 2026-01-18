/**
 * Discount Routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as discountController from '../controllers/discount.controller';

const router = Router();

router.use(authenticate);

// Apply discount to order (requires order update permission)
router.post('/apply',
    requirePermission('orders', 'update'),
    discountController.applyDiscount
);

// Remove discount from order
router.delete('/:orderId',
    requirePermission('orders', 'update'),
    discountController.removeDiscount
);

// Get discount reasons for UI
router.get('/reasons', discountController.getDiscountReasons);

// Get discount types for UI
router.get('/types', discountController.getDiscountTypes);

export default router;
