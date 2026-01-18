/**
 * @fileoverview Print Routing Routes.
 * Routes for configuring print routing (Toast-style).
 * 
 * @module routes/printRouting.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as printRoutingController from '../controllers/printRouting.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get routing configuration (categories, areas, printers)
router.get(
    '/config',
    requirePermission('printers', 'browse'),
    printRoutingController.getConfiguration
);

// Get routing preview for an order
router.get(
    '/order/:orderId',
    requirePermission('orders', 'browse'),
    printRoutingController.getOrderRouting
);

// Set category default printer
router.patch(
    '/category/:categoryId/printer',
    requirePermission('printers', 'update'),
    printRoutingController.setCategoryPrinter
);

// Set area printer override
router.post(
    '/area/:areaId/override',
    requirePermission('printers', 'update'),
    printRoutingController.setAreaOverride
);

// Remove area printer override
router.delete(
    '/area/:areaId/override',
    requirePermission('printers', 'delete'),
    printRoutingController.removeAreaOverride
);

export default router;
