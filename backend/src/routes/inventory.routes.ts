
import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as IngredientController from '../controllers/ingredient.controller';
import * as StockController from '../controllers/stockMovement.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Ingredients
router.get('/ingredients', requirePermission('stock', 'read'), IngredientController.getIngredients);
router.get('/ingredients/:id', validateId(), requirePermission('stock', 'read'), IngredientController.getIngredientById);
router.post('/ingredients', requirePermission('stock', 'create'), IngredientController.createIngredient);
router.put('/ingredients/:id', validateId(), requirePermission('stock', 'update'), IngredientController.updateIngredient);
router.delete('/ingredients/:id', validateId(), requirePermission('stock', 'delete'), IngredientController.deleteIngredient);

// Stock Movements
router.post('/stock-movements', requirePermission('stock', 'create'), StockController.registerMovement);
router.get('/stock-movements', requirePermission('stock', 'read'), StockController.getMovementHistory);

export default router;
