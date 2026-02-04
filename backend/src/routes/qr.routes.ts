/**
 * @fileoverview Rutas del Menú QR (Públicas y Administrativas)
 *
 * El módulo QR permite que los clientes escaneen un código QR en la mesa
 * y accedan al menú del restaurante desde su celular. Soporta dos modos:
 * - INTERACTIVE: El cliente puede armar su pedido y enviarlo.
 * - STATIC: Solo visualización del menú (el pedido lo toma el mesero).
 *
 * Este archivo exporta DOS routers separados:
 * - qrPublicRouter: Rutas sin autenticación, accedidas por clientes que escanean QR.
 *   Se monta en /api/v1/qr en app.ts.
 * - qrAdminRouter: Rutas con autenticación para gestionar códigos QR y configuración.
 *   Se monta en /api/v1/admin/qr en app.ts.
 *
 * @module routes/qr.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as qrController from '../controllers/qr.controller';

const router = Router();

// ============================================================================
// RUTAS PÚBLICAS (Sin autenticación)
// Estas rutas son accedidas por clientes al escanear el código QR de la mesa.
// No requieren login porque el cliente no tiene cuenta en el sistema.
// ============================================================================

// Validar un código QR y obtener la configuración del menú (modo, nombre del negocio)
router.get('/:code', qrController.validateQr);

// Obtener el menú público asociado al código QR (categorías y productos activos)
router.get('/:code/menu', qrController.getPublicMenu);

// Colocar un pedido desde el menú QR (self-order)
// El cliente envía los items del carrito y se agregan a la orden existente de la mesa
router.post('/:code/order', qrController.placeQrOrder);

// ============================================================================
// RUTAS ADMINISTRATIVAS (Requieren autenticación)
// Usadas desde el panel de administración para gestionar códigos QR.
// ============================================================================

const adminRouter = Router();
// Todas las rutas admin requieren usuario autenticado
adminRouter.use(authenticate);

// Obtener configuración QR del tenant (modo del menú, diseño, etc.)
adminRouter.get('/config', qrController.getConfig);
// Actualizar configuración QR (cambiar modo, personalizar apariencia)
adminRouter.patch('/config', requirePermission('settings', 'update'), qrController.updateConfig);

// Gestión de códigos QR individuales
// Listar todos los códigos QR generados para el tenant
adminRouter.get('/codes', qrController.getAllCodes);
// Generar nuevo código QR vinculado a una mesa
adminRouter.post('/codes', requirePermission('settings', 'update'), qrController.generateCode);
// Activar/desactivar un código QR sin eliminarlo
adminRouter.patch('/codes/:id/toggle', validateId(), requirePermission('settings', 'update'), qrController.toggleCode);
// Eliminar permanentemente un código QR
adminRouter.delete('/codes/:id', validateId(), requirePermission('settings', 'update'), qrController.deleteCode);

export { router as qrPublicRouter, adminRouter as qrAdminRouter };
