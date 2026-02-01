/**
 * @fileoverview Delivery Routes
 * Routes for managing delivery platforms and drivers
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as deliveryController from '../controllers/delivery.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// PLATFORMS
// ============================================================================

router.get('/platforms', deliveryController.getAllPlatforms);
router.get('/platforms/:id', validateId(), deliveryController.getPlatformById);
router.post('/platforms', requirePermission('settings', 'update'), deliveryController.createPlatform);
router.patch('/platforms/:id', validateId(), requirePermission('settings', 'update'), deliveryController.updatePlatform);
router.patch('/platforms/:id/toggle', validateId(), requirePermission('settings', 'update'), deliveryController.togglePlatform);
router.delete('/platforms/:id', validateId(), requirePermission('settings', 'update'), deliveryController.deletePlatform);

// ============================================================================
// DRIVERS
// ============================================================================

router.get('/drivers', deliveryController.getAllDrivers);
router.get('/drivers/available', deliveryController.getAvailableDrivers);
router.get('/drivers/:id', validateId(), deliveryController.getDriverById);
router.post('/drivers', requirePermission('settings', 'update'), deliveryController.createDriver);
router.patch('/drivers/:id', validateId(), requirePermission('settings', 'update'), deliveryController.updateDriver);
router.patch('/drivers/:id/availability', validateId(), deliveryController.toggleDriverAvailability);
router.patch('/drivers/:id/active', validateId(), requirePermission('settings', 'update'), deliveryController.toggleDriverActive);
router.post('/drivers/:id/assign', validateId(), deliveryController.assignDriverToOrder);
router.post('/drivers/:id/release', validateId(), deliveryController.releaseDriver);
router.delete('/drivers/:id', validateId(), requirePermission('settings', 'update'), deliveryController.deleteDriver);

// ============================================================================
// DELIVERY ORDERS
// ============================================================================

router.get('/orders', deliveryController.getDeliveryOrders);
// Assign User (with delivery role) as driver to an order
router.patch('/orders/:orderId/assign', validateId('orderId'), deliveryController.assignUserDriverToOrder);

export default router;
