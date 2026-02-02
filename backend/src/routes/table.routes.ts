import { Router } from 'express';
import {
  getAreas, createArea, updateArea, deleteArea,
  createTable, getTable, updateTable, updatePosition, updatePositions, deleteTable,
  openTable, closeTable
} from '../controllers/table.controller';
import { authenticateToken as authenticate, authorize } from '../middleware/auth';
import { validateId } from '../middleware/validateId';

const router = Router();

// /api/v1/areas
router.get('/areas', authenticate, getAreas);
router.post('/areas', authenticate, authorize(['ADMIN']), createArea);
router.put('/areas/:id', authenticate, validateId(), authorize(['ADMIN']), updateArea);
router.delete('/areas/:id', authenticate, validateId(), authorize(['ADMIN']), deleteArea);

// Routes for TABLES
// /api/v1/tables
router.put('/tables/positions', authenticate, authorize(['ADMIN']), updatePositions);
router.post('/tables', authenticate, authorize(['ADMIN']), createTable);
router.get('/tables/:id', authenticate, validateId(), getTable);
router.put('/tables/:id', authenticate, validateId(), authorize(['ADMIN']), updateTable);
router.put('/tables/:id/position', authenticate, validateId(), authorize(['ADMIN']), updatePosition);
router.delete('/tables/:id', authenticate, validateId(), authorize(['ADMIN']), deleteTable);

// Table Operations (Waiter)
router.post('/tables/:id/open', authenticate, validateId(), openTable);
router.post('/tables/:id/close', authenticate, validateId(), closeTable);

export const tableRouter = router;
