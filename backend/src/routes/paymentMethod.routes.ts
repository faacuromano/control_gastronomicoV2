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
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';

const router = Router();

// Ruta para el POS: obtener solo los métodos de pago activos (visible para todos los autenticados)
router.get('/active', authenticate, PaymentMethodController.getActive);

// --- Rutas administrativas ---
// Listar todos los métodos de pago - requiere permiso payment_methods:read
router.get('/', authenticate, requirePermission('payment_methods', 'read'), PaymentMethodController.getAll);
// Obtener detalle de un método de pago - requiere permiso payment_methods:read
router.get('/:id', authenticate, validateId(), requirePermission('payment_methods', 'read'), PaymentMethodController.getById);
// Crear nuevo método de pago - requiere permiso payment_methods:create
router.post('/', authenticate, requirePermission('payment_methods', 'create'), PaymentMethodController.create);
// Actualizar datos de un método de pago - requiere permiso payment_methods:update
router.put('/:id', authenticate, validateId(), requirePermission('payment_methods', 'update'), PaymentMethodController.update);
// Activar/desactivar un método de pago - requiere permiso payment_methods:update
router.patch('/:id/toggle', authenticate, validateId(), requirePermission('payment_methods', 'update'), PaymentMethodController.toggleActive);
// Eliminar permanentemente un método de pago - requiere permiso payment_methods:delete
router.delete('/:id', authenticate, validateId(), requirePermission('payment_methods', 'delete'), PaymentMethodController.remove);

// Inicializar métodos de pago por defecto - requiere permiso payment_methods:create
router.post('/seed', authenticate, requirePermission('payment_methods', 'create'), PaymentMethodController.seedDefaults);

export default router;
