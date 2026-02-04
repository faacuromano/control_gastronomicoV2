/**
 * @fileoverview Rutas de Gestión de Clientes
 *
 * Endpoints para buscar y crear clientes del restaurante. Los clientes se
 * asocian a órdenes para facturación, programas de fidelidad y delivery.
 * La búsqueda permite encontrar clientes por nombre, teléfono o email
 * para vincularlos rápidamente a una orden desde el POS.
 *
 * @module routes/client.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { searchClients, createClient } from '../controllers/client.controller';

const router = Router();

// Todas las rutas de clientes requieren usuario autenticado
router.use(authenticate);

// SEC-005: Buscar clientes requiere permiso de lectura
router.get('/search', requirePermission('clients', 'read'), searchClients);
// Crear un nuevo cliente (se puede hacer desde el POS al momento de facturar)
router.post('/', requirePermission('clients', 'create'), createClient);

export default router;
