import { Router } from 'express';
import { TableController } from '../controllers/table.controller';
import { authenticateToken as authenticate, authorize } from '../middleware/auth';

const router = Router();

// /api/v1/areas
router.get('/areas', authenticate, TableController.getAreas);
router.post('/areas', authenticate, authorize(['ADMIN']), TableController.createArea);
router.put('/areas/:id', authenticate, authorize(['ADMIN']), TableController.updateArea);
router.delete('/areas/:id', authenticate, authorize(['ADMIN']), TableController.deleteArea);

// Routes for TABLES
// /api/v1/tables
router.put('/tables/positions', authenticate, authorize(['ADMIN']), TableController.updatePositions);
router.post('/tables', authenticate, authorize(['ADMIN']), TableController.createTable);
router.get('/tables/:id', authenticate, TableController.getTable);
router.put('/tables/:id', authenticate, authorize(['ADMIN']), TableController.updateTable);
router.put('/tables/:id/position', authenticate, authorize(['ADMIN']), TableController.updatePosition);
router.delete('/tables/:id', authenticate, authorize(['ADMIN']), TableController.deleteTable);

// Table Operations (Waiter)
router.post('/tables/:id/open', authenticate, TableController.openTable);
router.post('/tables/:id/close', authenticate, TableController.closeTable);

export const tableRouter = router;
