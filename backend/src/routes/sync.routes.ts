/**
 * @fileoverview Rutas de Sincronización Offline
 *
 * Implementa el protocolo de sincronización para el modo offline del POS.
 * Cuando el dispositivo pierde conexión a internet, las operaciones se
 * almacenan localmente y se sincronizan al recuperar conectividad.
 *
 * Flujo de sincronización:
 * 1. GET /pull: El cliente descarga los datos necesarios para operar offline
 *    (productos, categorías, mesas, configuración del tenant).
 * 2. POST /push: El cliente envía las operaciones realizadas offline
 *    (órdenes creadas, pagos registrados) para que el servidor las procese.
 * 3. GET /status: Verificar si el servidor está disponible y obtener
 *    timestamp de última sincronización.
 *
 * @module routes/sync.routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as syncController from '../controllers/sync.controller';

const router = Router();

// Todas las rutas de sincronización requieren autenticación
router.use(authenticate);

// GET /api/v1/sync/pull - Descargar datos para caché offline del dispositivo
router.get('/pull', syncController.pull);

// POST /api/v1/sync/push - Enviar operaciones realizadas durante el modo offline
router.post('/push', syncController.push);

// GET /api/v1/sync/status - Verificar estado del servidor y timestamp de última sync
router.get('/status', syncController.status);

export default router;
