import { Router } from 'express';
import * as PaymentMethodController from '../controllers/paymentMethod.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public route for POS - get active methods only
router.get('/active', authenticate, PaymentMethodController.getActive);

// Admin routes
router.get('/', authenticate, authorize(['ADMIN']), PaymentMethodController.getAll);
router.get('/:id', authenticate, authorize(['ADMIN']), PaymentMethodController.getById);
router.post('/', authenticate, authorize(['ADMIN']), PaymentMethodController.create);
router.put('/:id', authenticate, authorize(['ADMIN']), PaymentMethodController.update);
router.patch('/:id/toggle', authenticate, authorize(['ADMIN']), PaymentMethodController.toggleActive);
router.delete('/:id', authenticate, authorize(['ADMIN']), PaymentMethodController.remove);

// Seed defaults (admin only, for initial setup)
router.post('/seed', authenticate, authorize(['ADMIN']), PaymentMethodController.seedDefaults);

export default router;
