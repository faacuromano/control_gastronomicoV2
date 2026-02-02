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
 * Nota: Este archivo no aplica middleware de autenticación a nivel de router.
 * La autenticación se debe manejar en el archivo que monta estas rutas (app.ts)
 * o agregarse aquí si se requiere.
 *
 * @module routes/purchaseOrder.routes
 */

import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import * as PurchaseOrderController from '../controllers/purchaseOrder.controller';

const router = Router();

// Listar todas las órdenes de compra del tenant con filtros opcionales
router.get('/purchase-orders', PurchaseOrderController.getPurchaseOrders);
// Obtener detalle de una orden de compra con sus ítems y proveedor
router.get('/purchase-orders/:id', validateId(), PurchaseOrderController.getPurchaseOrderById);
// Crear nueva orden de compra (proveedor + lista de ingredientes con cantidades)
router.post('/purchase-orders', PurchaseOrderController.createPurchaseOrder);
// Cambiar estado de la orden de compra (ej: PENDING -> ORDERED al confirmar con proveedor)
router.patch('/purchase-orders/:id/status', validateId(), PurchaseOrderController.updatePurchaseOrderStatus);
// Recibir mercadería: registra la recepción y genera movimientos de stock automáticos
router.post('/purchase-orders/:id/receive', validateId(), PurchaseOrderController.receivePurchaseOrder);
// Cancelar una orden de compra (solo si no ha sido recibida completamente)
router.post('/purchase-orders/:id/cancel', validateId(), PurchaseOrderController.cancelPurchaseOrder);
// Eliminar permanentemente una orden de compra
router.delete('/purchase-orders/:id', validateId(), PurchaseOrderController.deletePurchaseOrder);

export default router;
