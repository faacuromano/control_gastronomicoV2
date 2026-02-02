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
import { authenticateToken as authenticate, authorize } from '../middleware/auth';
import { validateId } from '../middleware/validateId';

const router = Router();

// --- Áreas del restaurante (/api/v1/areas) ---
// Listar todas las áreas con sus mesas (para el mapa del restaurante)
router.get('/areas', authenticate, getAreas);
// Crear nueva área (solo ADMIN)
router.post('/areas', authenticate, authorize(['ADMIN']), createArea);
// Actualizar nombre u orden de un área (solo ADMIN)
router.put('/areas/:id', authenticate, validateId(), authorize(['ADMIN']), updateArea);
// Eliminar un área y sus mesas (solo ADMIN)
router.delete('/areas/:id', authenticate, validateId(), authorize(['ADMIN']), deleteArea);

// --- Mesas (/api/v1/tables) ---
// Actualizar posiciones de múltiples mesas a la vez (drag & drop en el mapa, solo ADMIN)
router.put('/tables/positions', authenticate, authorize(['ADMIN']), updatePositions);
// Crear nueva mesa en un área (solo ADMIN)
router.post('/tables', authenticate, authorize(['ADMIN']), createTable);
// Obtener detalle de una mesa (estado, orden actual, área)
router.get('/tables/:id', authenticate, validateId(), getTable);
// Actualizar datos de una mesa (nombre, capacidad, etc., solo ADMIN)
router.put('/tables/:id', authenticate, validateId(), authorize(['ADMIN']), updateTable);
// Actualizar posición individual de una mesa en el mapa (solo ADMIN)
router.put('/tables/:id/position', authenticate, validateId(), authorize(['ADMIN']), updatePosition);
// Eliminar una mesa (solo ADMIN, falla si tiene orden activa)
router.delete('/tables/:id', authenticate, validateId(), authorize(['ADMIN']), deleteTable);

// --- Operaciones de mesa (Mesero/Cajero) ---
// Abrir mesa: cambia estado a OCCUPIED y puede crear orden automáticamente
router.post('/tables/:id/open', authenticate, validateId(), openTable);
// Cerrar mesa: cambia estado a FREE después de cobrar la orden
router.post('/tables/:id/close', authenticate, validateId(), closeTable);

export const tableRouter = router;
