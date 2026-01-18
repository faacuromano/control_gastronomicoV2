/**
 * Bulk Price Update Routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as bulkPriceController from '../controllers/bulkPriceUpdate.controller';

const router = Router();

router.use(authenticate);

// Get products for price grid
router.get('/products',
    requirePermission('products', 'browse'),
    bulkPriceController.getProductsForGrid
);

// Get categories for dropdown
router.get('/categories',
    requirePermission('products', 'browse'),
    bulkPriceController.getCategories
);

// Preview price changes
router.post('/preview',
    requirePermission('products', 'update'),
    bulkPriceController.previewChanges
);

// Apply bulk updates (requires admin-level permission)
router.post('/apply',
    requirePermission('products', 'update'),
    bulkPriceController.applyUpdates
);

// Update entire category
router.post('/category/:categoryId',
    requirePermission('products', 'update'),
    bulkPriceController.updateByCategory
);

export default router;
