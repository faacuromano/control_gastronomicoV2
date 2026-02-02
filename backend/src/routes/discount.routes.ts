/**
 * @fileoverview Rutas de Descuentos sobre Órdenes
 *
 * Permite aplicar y quitar descuentos a órdenes existentes. Los descuentos
 * pueden ser porcentuales o de monto fijo, y requieren una razón justificativa
 * (cortesía, error, promoción, etc.). Solo usuarios con permiso de actualización
 * de órdenes pueden operar descuentos.
 *
 * También expone endpoints de catálogo (razones y tipos de descuento) que
 * el frontend consume para poblar dropdowns en la UI.
 *
 * @module routes/discount.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as discountController from '../controllers/discount.controller';

const router = Router();

// Todas las rutas de descuento requieren autenticación
router.use(authenticate);

// Aplicar un descuento a una orden (requiere permiso de actualización de órdenes)
router.post('/apply',
    requirePermission('orders', 'update'),
    discountController.applyDiscount
);

// Quitar el descuento de una orden específica
router.delete('/:orderId',
    validateId('orderId'),
    requirePermission('orders', 'update'),
    discountController.removeDiscount
);

// Obtener las razones de descuento disponibles (cortesía, error, promoción, etc.)
router.get('/reasons', discountController.getDiscountReasons);

// Obtener los tipos de descuento disponibles (porcentaje, monto fijo)
router.get('/types', discountController.getDiscountTypes);

export default router;
