/**
 * @fileoverview Rutas de Áreas y Mesas del Restaurante
 *
 * Gestiona la configuración del layout del restaurante: áreas (salón, terraza,
 * barra, etc.) y mesas dentro de cada área. Las mesas tienen posiciones X/Y
 * para renderizar el mapa visual del restaurante en el frontend.
 *
 * Existen dos tipos de operaciones:
 * 1. Administrativas (CRUD de áreas y mesas): Solo rol ADMIN puede crear,
 *    mover o eliminar mesas y áreas.
 * 2. Operativas (abrir/cerrar mesa): Cualquier usuario autenticado (mesero,
 *    cajero) puede abrir una mesa al iniciar un servicio y cerrarla al cobrar.
 *
 * Se montan bajo /api/v1/areas y /api/v1/tables en app.ts.
 *
 * @module routes/table.routes
 */

import { Router } from 'express';
import {
  getAreas, createArea, updateArea, deleteArea,
  createTable, getTable, updateTable, updatePosition, updatePositions, deleteTable,
  openTable, closeTable
} from '../controllers/table.controller';
import { authenticateToken as authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';

const router = Router();

// --- Áreas del restaurante (/api/v1/areas) ---
// Listar todas las áreas con sus mesas (para el mapa del restaurante) - requiere permiso tables:read
router.get('/areas', authenticate, requirePermission('tables', 'read'), getAreas);
// Crear nueva área - requiere permiso tables:create
router.post('/areas', authenticate, requirePermission('tables', 'create'), createArea);
// Actualizar nombre u orden de un área - requiere permiso tables:update
router.put('/areas/:id', authenticate, validateId(), requirePermission('tables', 'update'), updateArea);
// Eliminar un área y sus mesas - requiere permiso tables:delete
router.delete('/areas/:id', authenticate, validateId(), requirePermission('tables', 'delete'), deleteArea);

// --- Mesas (/api/v1/tables) ---
// Actualizar posiciones de múltiples mesas (drag & drop) - requiere permiso tables:update
router.put('/tables/positions', authenticate, requirePermission('tables', 'update'), updatePositions);
// Crear nueva mesa en un área - requiere permiso tables:create
router.post('/tables', authenticate, requirePermission('tables', 'create'), createTable);
// Obtener detalle de una mesa - requiere permiso tables:read
router.get('/tables/:id', authenticate, validateId(), requirePermission('tables', 'read'), getTable);
// Actualizar datos de una mesa - requiere permiso tables:update
router.put('/tables/:id', authenticate, validateId(), requirePermission('tables', 'update'), updateTable);
// Actualizar posición individual de una mesa - requiere permiso tables:update
router.put('/tables/:id/position', authenticate, validateId(), requirePermission('tables', 'update'), updatePosition);
// Eliminar una mesa - requiere permiso tables:delete
router.delete('/tables/:id', authenticate, validateId(), requirePermission('tables', 'delete'), deleteTable);

// --- Operaciones de mesa (Mesero/Cajero) ---
// Abrir mesa: crea orden automáticamente - requiere permiso orders:create
router.post('/tables/:id/open', authenticate, validateId(), requirePermission('orders', 'create'), openTable);
// Cerrar mesa: procesa pago - requiere permiso orders:update
router.post('/tables/:id/close', authenticate, validateId(), requirePermission('orders', 'update'), closeTable);

export const tableRouter = router;
