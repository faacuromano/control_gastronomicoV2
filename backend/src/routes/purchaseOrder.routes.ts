/**
 * @fileoverview Rutas de Órdenes de Compra a Proveedores
 *
 * Gestiona el ciclo de vida de las órdenes de compra: creación, consulta,
 * cambio de estado, recepción de mercadería y cancelación. Las órdenes de
 * compra se vinculan a un proveedor y contienen ítems (ingredientes con
 * cantidad y precio). Al recibir la mercadería, se generan automáticamente
 * movimientos de stock tipo PURCHASE.
 *
 * Estados posibles: PENDING -> ORDERED -> PARTIAL -> RECEIVED / CANCELLED
 *
 * FIX-002 (SEC-002): Todas las rutas requieren autenticación. Las operaciones
 * de escritura (POST/PATCH/DELETE) requieren rol ADMIN.
 *
 * @module routes/purchaseOrder.routes
 */

import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import { authenticate, requirePermission } from '../middleware/auth';
import * as PurchaseOrderController from '../controllers/purchaseOrder.controller';

const router = Router();

// Listar todas las órdenes de compra - requiere permiso purchase_orders:read
router.get('/purchase-orders', authenticate, requirePermission('purchase_orders', 'read'), PurchaseOrderController.getPurchaseOrders);
// Obtener detalle de una orden de compra - requiere permiso purchase_orders:read
router.get('/purchase-orders/:id', authenticate, validateId(), requirePermission('purchase_orders', 'read'), PurchaseOrderController.getPurchaseOrderById);
// Crear nueva orden de compra - requiere permiso purchase_orders:create
router.post('/purchase-orders', authenticate, requirePermission('purchase_orders', 'create'), PurchaseOrderController.createPurchaseOrder);
// Cambiar estado de la orden - requiere permiso purchase_orders:update
router.patch('/purchase-orders/:id/status', authenticate, validateId(), requirePermission('purchase_orders', 'update'), PurchaseOrderController.updatePurchaseOrderStatus);
// Recibir mercadería - requiere permiso purchase_orders:update
router.post('/purchase-orders/:id/receive', authenticate, validateId(), requirePermission('purchase_orders', 'update'), PurchaseOrderController.receivePurchaseOrder);
// Cancelar una orden - requiere permiso purchase_orders:update
router.post('/purchase-orders/:id/cancel', authenticate, validateId(), requirePermission('purchase_orders', 'update'), PurchaseOrderController.cancelPurchaseOrder);
// Eliminar permanentemente - requiere permiso purchase_orders:delete
router.delete('/purchase-orders/:id', authenticate, validateId(), requirePermission('purchase_orders', 'delete'), PurchaseOrderController.deletePurchaseOrder);

export default router;
