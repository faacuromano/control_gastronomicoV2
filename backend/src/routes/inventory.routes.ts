/**
 * @fileoverview Rutas de Inventario (Ingredientes y Movimientos de Stock)
 *
 * Gestiona dos recursos del módulo de inventario:
 *
 * 1. Ingredientes: CRUD de materias primas con control de stock, costo unitario
 *    y stock mínimo para alertas automáticas. Los ingredientes se vinculan a
 *    productos mediante la tabla ProductIngredient (recetas).
 *
 * 2. Movimientos de Stock: Registro de entradas (compras), salidas (ventas,
 *    mermas) y ajustes manuales. Cada movimiento actualiza el stock actual
 *    del ingrediente de forma atómica.
 *
 * Todas las rutas requieren autenticación y permisos sobre el recurso 'stock'.
 *
 * @module routes/inventory.routes
 */

import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as IngredientController from '../controllers/ingredient.controller';
import * as StockController from '../controllers/stockMovement.controller';

const router = Router();

// Todas las rutas de inventario requieren autenticación
router.use(authenticateToken);

// --- Ingredientes ---
// Listar todos los ingredientes del tenant con su stock actual
router.get('/ingredients', requirePermission('stock', 'read'), IngredientController.getIngredients);
// Obtener detalle de un ingrediente (incluye recetas donde se usa)
router.get('/ingredients/:id', validateId(), requirePermission('stock', 'read'), IngredientController.getIngredientById);
// Crear nuevo ingrediente (nombre, unidad de medida, costo, stock inicial, stock mínimo)
router.post('/ingredients', requirePermission('stock', 'create'), IngredientController.createIngredient);
// Actualizar datos de un ingrediente existente
router.put('/ingredients/:id', validateId(), requirePermission('stock', 'update'), IngredientController.updateIngredient);
// Eliminar un ingrediente (falla si tiene movimientos o está asociado a productos)
router.delete('/ingredients/:id', validateId(), requirePermission('stock', 'delete'), IngredientController.deleteIngredient);

// --- Movimientos de Stock ---
// Registrar un movimiento de stock (compra, venta, merma, ajuste)
router.post('/stock-movements', requirePermission('stock', 'create'), StockController.registerMovement);
// Consultar historial de movimientos con filtros opcionales (ingrediente, tipo, fecha)
router.get('/stock-movements', requirePermission('stock', 'read'), StockController.getMovementHistory);

export default router;
