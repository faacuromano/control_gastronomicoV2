
import { Router } from 'express';
import * as IngredientController from '../controllers/ingredient.controller';
import * as StockController from '../controllers/stockMovement.controller';

const router = Router();

// Ingredients
router.get('/ingredients', IngredientController.getIngredients);
router.get('/ingredients/:id', IngredientController.getIngredientById);
router.post('/ingredients', IngredientController.createIngredient);
router.put('/ingredients/:id', IngredientController.updateIngredient);
router.delete('/ingredients/:id', IngredientController.deleteIngredient);

// Stock Movements
router.post('/stock-movements', StockController.registerMovement);
router.get('/stock-movements', StockController.getMovementHistory);

export default router;
