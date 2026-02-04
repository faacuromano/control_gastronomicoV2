/**
 * @fileoverview Rutas de Facturación
 *
 * Endpoints para generar y consultar comprobantes fiscales (tickets y facturas).
 * Cada factura se vincula a una orden y tiene un número secuencial único por tenant.
 * Soporta dos tipos de comprobante: RECEIPT (ticket simplificado) e INVOICE_B
 * (factura tipo B con datos fiscales del cliente).
 *
 * Todas las rutas requieren autenticación. No se requieren permisos especiales
 * porque cualquier usuario operativo (cajero, mesero) necesita generar comprobantes.
 *
 * @module routes/invoice.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as invoiceController from '../controllers/invoice.controller';

const router = Router();

// Todas las rutas de facturación requieren autenticación
router.use(authenticate);

/**
 * GET /invoices
 * Listar facturas con filtros opcionales (tipo de comprobante, rango de fechas).
 * Utilizado en el módulo de administración para consultar historial fiscal.
 */
router.get('/', requirePermission('invoices', 'read'), invoiceController.getAll);

/**
 * POST /invoices
 * Generar comprobante fiscal para una orden. Asigna número secuencial
 * automático y guarda los datos del cliente si es factura tipo B.
 */
router.post('/', requirePermission('invoices', 'create'), invoiceController.generateInvoice);

/**
 * GET /invoices/order/:orderId
 * Obtener el comprobante asociado a una orden específica.
 * Útil para reimprimir o consultar desde la vista de detalle de orden.
 */
router.get('/order/:orderId', validateId('orderId'), requirePermission('invoices', 'read'), invoiceController.getByOrderId);

/**
 * GET /invoices/:invoiceNumber
 * Buscar comprobante por su número de factura (búsqueda directa).
 */
router.get('/:invoiceNumber', requirePermission('invoices', 'read'), invoiceController.getByInvoiceNumber);

export default router;
