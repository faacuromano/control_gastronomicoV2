/**
 * @fileoverview Rutas de Órdenes (CRUD, Pagos, Anulaciones, Transferencias)
 *
 * Archivo central de rutas para el manejo del ciclo de vida de órdenes.
 * Incluye creación, lectura, cambio de estado, gestión de ítems (agregar,
 * servir, anular), procesamiento de pagos y transferencia de ítems entre mesas.
 *
 * Las rutas se montan bajo /api/v1/orders en app.ts. Cada operación requiere
 * un permiso RBAC específico (orders:create, orders:read, orders:update, orders:delete).
 *
 * Características de seguridad:
 * - Middleware de idempotencia en creación y pagos para evitar duplicados por reintentos de red
 * - Validación de IDs en parámetros de URL con validateId()
 * - Permisos granulares (la anulación requiere orders:delete, típicamente solo managers)
 *
 * @module routes/order.routes
 */

import { Router } from 'express';
import * as OrderController from '../controllers/order.controller';
import { authenticateToken as authenticate, requirePermission } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validateId } from '../middleware/validateId';

const router = Router();

// Todas las rutas de órdenes requieren autenticación
router.use(authenticate);

// Las rutas son relativas a /api/v1/orders (donde se monta este router en app.ts)

// Crear orden - requiere orders:create
// P1-04: El middleware de idempotencia previene órdenes duplicadas por reintentos de red
router.post('/', requirePermission('orders', 'create'), idempotency, OrderController.createOrder);

// Lectura de órdenes - requiere orders:read
// Listar órdenes con filtros (estado, fecha, canal, etc.)
router.get('/', requirePermission('orders', 'read'), OrderController.getOrders);
// Obtener la orden activa de una mesa específica (usado al tocar una mesa en el mapa)
router.get('/table/:tableId', validateId('tableId'), requirePermission('orders', 'read'), OrderController.getOrderByTable);
// Obtener órdenes activas para el Kitchen Display System (KDS)
router.get('/kds', requirePermission('orders', 'read'), OrderController.getActiveOrders);

// Actualización de estado - requiere orders:update
// Cambiar estado general de la orden (OPEN -> CONFIRMED -> IN_PREPARATION -> etc.)
router.patch('/:id/status', validateId(), requirePermission('orders', 'update'), OrderController.updateStatus);
// Cambiar estado de un ítem individual (PENDING -> COOKING -> READY -> SERVED)
router.patch('/items/:itemId/status', validateId('itemId'), requirePermission('orders', 'update'), OrderController.updateItemStatus);
// Agregar nuevos ítems a una orden existente (segunda ronda de pedidos)
router.post('/:orderId/items', validateId('orderId'), requirePermission('orders', 'update'), OrderController.addItemsToOrder);
// Marcar todos los ítems de una orden como servidos de una vez
router.post('/:orderId/items/served', validateId('orderId'), requirePermission('orders', 'update'), OrderController.markAllItemsServed);

// Operaciones de pago - requiere orders:update
// POST /api/v1/orders/:id/payments - Agregar pagos a una orden existente (soporta pagos parciales)
router.post('/:id/payments', validateId(), requirePermission('orders', 'update'), idempotency, OrderController.addPayments);

// Anulación de ítems - requiere orders:delete (acción de manager)
// Anular un ítem con motivo obligatorio (registra auditoría)
router.delete('/items/:itemId/void', validateId('itemId'), requirePermission('orders', 'delete'), OrderController.voidItem);
// Obtener catálogo de motivos de anulación para la UI
router.get('/void-reasons', requirePermission('orders', 'read'), OrderController.getVoidReasons);

// Transferir ítems entre mesas - requiere orders:update
// Permite mover ítems de una orden a otra (cuando un cliente cambia de mesa)
router.post('/items/transfer', requirePermission('orders', 'update'), OrderController.transferItems);

export default router;
