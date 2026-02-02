/**
 * @fileoverview Rutas de Configuración de Métodos de Pago
 *
 * Gestiona los métodos de pago disponibles para el tenant (efectivo, tarjeta,
 * transferencia, QR integrado, etc.). Cada método tiene un código único,
 * nombre, ícono y estado activo/inactivo.
 *
 * Existe una ruta pública para el POS (/active) que devuelve solo los métodos
 * activos, y rutas administrativas (CRUD completo) restringidas al rol ADMIN.
 *
 * El endpoint /seed permite inicializar los métodos de pago por defecto al
 * configurar un nuevo tenant.
 *
 * @module routes/paymentMethod.routes
 */

import { Router } from 'express';
import * as PaymentMethodController from '../controllers/paymentMethod.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateId } from '../middleware/validateId';

const router = Router();

// Ruta para el POS: obtener solo los métodos de pago activos (visible para todos los autenticados)
router.get('/active', authenticate, PaymentMethodController.getActive);

// --- Rutas administrativas (solo rol ADMIN) ---
// Listar todos los métodos de pago (activos e inactivos)
router.get('/', authenticate, authorize(['ADMIN']), PaymentMethodController.getAll);
// Obtener detalle de un método de pago por ID
router.get('/:id', authenticate, validateId(), authorize(['ADMIN']), PaymentMethodController.getById);
// Crear nuevo método de pago personalizado
router.post('/', authenticate, authorize(['ADMIN']), PaymentMethodController.create);
// Actualizar datos de un método de pago (nombre, ícono, etc.)
router.put('/:id', authenticate, validateId(), authorize(['ADMIN']), PaymentMethodController.update);
// Activar/desactivar un método de pago (sin eliminarlo)
router.patch('/:id/toggle', authenticate, validateId(), authorize(['ADMIN']), PaymentMethodController.toggleActive);
// Eliminar permanentemente un método de pago
router.delete('/:id', authenticate, validateId(), authorize(['ADMIN']), PaymentMethodController.remove);

// Inicializar métodos de pago por defecto (solo ADMIN, para configuración inicial del tenant)
router.post('/seed', authenticate, authorize(['ADMIN']), PaymentMethodController.seedDefaults);

export default router;
