/**
 * @fileoverview Rutas de Alertas de Stock Bajo
 *
 * Endpoints para consultar ingredientes cuyo stock actual está por debajo
 * del mínimo configurado (minStock), y para difundir el estado de alertas
 * a los clientes conectados por WebSocket en tiempo real.
 *
 * El endpoint de broadcast es útil para forzar una actualización inmediata
 * en todas las pantallas conectadas (ej: después de registrar un movimiento
 * de stock manualmente).
 *
 * @module routes/stockAlert.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as stockAlertController from '../controllers/stockAlert.controller';

const router = Router();

// Todas las rutas de alertas requieren autenticación
router.use(authenticate);

// Obtener lista de ingredientes con stock bajo (stock actual < minStock)
router.get('/',
    requirePermission('ingredients', 'browse'),
    stockAlertController.getLowStockItems
);

// Enviar estado actual de alertas a todos los clientes WebSocket conectados
router.post('/broadcast',
    requirePermission('ingredients', 'browse'),
    stockAlertController.broadcastStatus
);

export default router;
