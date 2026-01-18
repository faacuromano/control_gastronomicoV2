/**
 * Stock Alert Routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as stockAlertController from '../controllers/stockAlert.controller';

const router = Router();

router.use(authenticate);

// Get current low stock items
router.get('/', 
    requirePermission('ingredients', 'browse'),
    stockAlertController.getLowStockItems
);

// Broadcast current status to connected WebSocket clients
router.post('/broadcast',
    requirePermission('ingredients', 'browse'),
    stockAlertController.broadcastStatus
);

export default router;
