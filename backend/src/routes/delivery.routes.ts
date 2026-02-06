/**
 * @fileoverview Rutas de Delivery (Plataformas, Conductores y Órdenes)
 *
 * Gestiona tres recursos principales del módulo de delivery:
 *
 * 1. Plataformas: Configuración de integraciones con PedidosYa, Rappi, etc.
 *    Las plataformas son globales (DeliveryPlatform) pero cada tenant configura
 *    sus credenciales y estado (TenantPlatformConfig).
 *
 * 2. Conductores: CRUD de repartidores propios del restaurante para delivery propio.
 *    Incluye gestión de disponibilidad y asignación a órdenes.
 *
 * 3. Órdenes de delivery: Consulta y asignación de repartidores a órdenes
 *    con fulfillment type SELF_DELIVERY o PLATFORM_DELIVERY.
 *
 * @module routes/delivery.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as deliveryController from '../controllers/delivery.controller';

const router = Router();

// Todas las rutas de delivery requieren autenticación
router.use(authenticate);

// ============================================================================
// PLATAFORMAS DE DELIVERY (PedidosYa, Rappi, etc.)
// La lectura es libre para usuarios autenticados; las modificaciones
// requieren permiso de configuración (settings:update).
// ============================================================================

// Listar todas las plataformas disponibles (globales + config del tenant)
router.get('/platforms', requirePermission('delivery', 'read'), deliveryController.getAllPlatforms);
// Obtener detalle de una plataforma específica
router.get('/platforms/:id', validateId(), requirePermission('delivery', 'read'), deliveryController.getPlatformById);
// Crear nueva plataforma de delivery (solo admin de configuración)
router.post('/platforms', requirePermission('settings', 'update'), deliveryController.createPlatform);
// Actualizar datos de una plataforma (credenciales, nombre, etc.)
router.patch('/platforms/:id', validateId(), requirePermission('settings', 'update'), deliveryController.updatePlatform);
// Activar/desactivar una plataforma para el tenant
router.patch('/platforms/:id/toggle', validateId(), requirePermission('settings', 'update'), deliveryController.togglePlatform);
// Eliminar configuración de plataforma del tenant
router.delete('/platforms/:id', validateId(), requirePermission('settings', 'update'), deliveryController.deletePlatform);

// ============================================================================
// CONDUCTORES / REPARTIDORES
// Gestión de repartidores propios del restaurante. La lectura es libre;
// las modificaciones de CRUD requieren permiso de configuración.
// La asignación/liberación la puede hacer cualquier usuario autenticado
// (meseros, cajeros) para agilizar la operación.
// ============================================================================

// Listar todos los conductores del tenant
router.get('/drivers', requirePermission('delivery', 'read'), deliveryController.getAllDrivers);
// Listar solo conductores disponibles (activos y no asignados a otra orden)
router.get('/drivers/available', requirePermission('delivery', 'read'), deliveryController.getAvailableDrivers);
// Obtener detalle de un conductor específico
router.get('/drivers/:id', validateId(), requirePermission('delivery', 'read'), deliveryController.getDriverById);
// Crear nuevo conductor/repartidor
router.post('/drivers', requirePermission('settings', 'update'), deliveryController.createDriver);
// Actualizar datos de un conductor (nombre, teléfono, tipo de vehículo)
router.patch('/drivers/:id', validateId(), requirePermission('settings', 'update'), deliveryController.updateDriver);
// Cambiar disponibilidad de un conductor (disponible/no disponible)
router.patch('/drivers/:id/availability', validateId(), requirePermission('delivery', 'update'), deliveryController.toggleDriverAvailability);
// Activar/desactivar un conductor (baja temporal sin eliminarlo)
router.patch('/drivers/:id/active', validateId(), requirePermission('settings', 'update'), deliveryController.toggleDriverActive);
// Asignar un conductor a una orden de delivery
router.post('/drivers/:id/assign', validateId(), requirePermission('delivery', 'update'), deliveryController.assignDriverToOrder);
// Liberar un conductor de su orden actual (al completar la entrega)
router.post('/drivers/:id/release', validateId(), requirePermission('delivery', 'update'), deliveryController.releaseDriver);
// Eliminar un conductor permanentemente
router.delete('/drivers/:id', validateId(), requirePermission('settings', 'update'), deliveryController.deleteDriver);

// ============================================================================
// ÓRDENES DE DELIVERY
// Consulta de órdenes con canal delivery y asignación de usuarios
// con rol de repartidor a dichas órdenes.
// ============================================================================

// Listar órdenes de delivery (filtradas por estado, fecha, etc.)
router.get('/orders', requirePermission('delivery', 'read'), deliveryController.getDeliveryOrders);
// Asignar un usuario con rol de delivery como repartidor de una orden
router.patch('/orders/:orderId/assign', validateId('orderId'), requirePermission('delivery', 'update'), deliveryController.assignUserDriverToOrder);

export default router;
