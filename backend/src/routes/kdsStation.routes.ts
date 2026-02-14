/**
 * @fileoverview Rutas de Estaciones KDS
 *
 * Endpoints para gestionar las estaciones del Kitchen Display System.
 * Todas las rutas requieren autenticación.
 *
 * @module routes/kdsStation.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as kdsStationController from '../controllers/kdsStation.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// SEC-FIX: Require settings:read permission for KDS station configuration access
// Listar estaciones - requiere permiso settings:read
router.get('/', requirePermission('settings', 'read'), kdsStationController.getStations);

// Obtener estación por ID - requiere permiso settings:read
router.get('/:id', validateId(), requirePermission('settings', 'read'), kdsStationController.getStation);

// Crear estación (requiere permiso de settings)
router.post('/', requirePermission('settings', 'update'), kdsStationController.createStation);

// Crear estaciones por defecto (requiere permiso de settings)
router.post('/seed', requirePermission('settings', 'update'), kdsStationController.seedDefaultStations);

// Actualizar estación
router.patch('/:id', validateId(), requirePermission('settings', 'update'), kdsStationController.updateStation);

// Eliminar estación
router.delete('/:id', validateId(), requirePermission('settings', 'update'), kdsStationController.deleteStation);

// Establecer como default
router.post('/:id/set-default', validateId(), requirePermission('settings', 'update'), kdsStationController.setDefaultStation);

export default router;
