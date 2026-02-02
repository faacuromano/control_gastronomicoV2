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
import { authenticate } from '../middleware/auth';
import { searchClients, createClient } from '../controllers/client.controller';

const router = Router();

// Todas las rutas de clientes requieren usuario autenticado
router.use(authenticate);

// Buscar clientes por nombre, teléfono o email (usado en el POS y delivery)
router.get('/search', searchClients);
// Crear un nuevo cliente (se puede hacer desde el POS al momento de facturar)
router.post('/', createClient);

export default router;
