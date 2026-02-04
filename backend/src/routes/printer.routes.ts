/**
 * @fileoverview Rutas de Impresoras y Operaciones de Impresión
 *
 * Gestiona dos aspectos del módulo de impresión:
 *
 * 1. CRUD de Impresoras: Registrar y administrar las impresoras del local
 *    (térmicas de red, USB, impresoras del sistema Windows).
 *
 * 2. Operaciones de Impresión: Generar e imprimir tickets de orden,
 *    pre-cuentas (lo que se lleva a la mesa antes de cobrar), y páginas
 *    de prueba para verificar la conectividad de la impresora.
 *
 * Las impresoras se usan junto con el módulo de print routing para enviar
 * automáticamente cada categoría de producto a la impresora correcta
 * (ej: bebidas a la barra, comidas a la cocina).
 *
 * @module routes/printer.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as printerController from '../controllers/printer.controller';

const router = Router();

// Todas las rutas de impresión requieren autenticación
router.use(authenticate);

// --- CRUD de Impresoras (SEC-005: requiere permisos de administración) ---
// Listar todas las impresoras configuradas para el tenant
router.get('/printers', requirePermission('printers', 'read'), printerController.getPrinters);
// Listar impresoras del sistema operativo Windows (para descubrimiento automático)
router.get('/printers/system', requirePermission('printers', 'read'), printerController.getSystemPrinters);
// Registrar nueva impresora (nombre, tipo de conexión, IP/puerto)
router.post('/printers', requirePermission('printers', 'create'), printerController.createPrinter);
// Actualizar configuración de una impresora existente
router.put('/printers/:id', validateId(), requirePermission('printers', 'update'), printerController.updatePrinter);
// Eliminar una impresora del tenant
router.delete('/printers/:id', validateId(), requirePermission('printers', 'delete'), printerController.deletePrinter);

// --- Operaciones de Impresión (cualquier usuario autenticado puede imprimir) ---
// Generar buffer de ticket para una orden (retorna los datos de impresión)
router.get('/:id', validateId(), requirePermission('orders', 'read'), printerController.printTicket);
// Enviar ticket de una orden a una impresora específica (impresión directa)
router.post('/:orderId/device/:printerId', validateId('orderId', 'printerId'), requirePermission('orders', 'read'), printerController.printToDevice);
// Imprimir pre-cuenta (cuenta parcial que se lleva a la mesa antes de cobrar)
router.post('/:orderId/preaccount/:printerId', validateId('orderId', 'printerId'), requirePermission('orders', 'read'), printerController.printPreAccount);
// Imprimir página de prueba para verificar conectividad de la impresora
router.post('/test/:printerId', validateId('printerId'), requirePermission('printers', 'update'), printerController.printTestPage);

export default router;
