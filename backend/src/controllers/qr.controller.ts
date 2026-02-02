/**
 * @fileoverview Controlador de Menú QR
 *
 * Gestiona los códigos QR que dan acceso al menú digital del restaurante.
 * Soporta dos modos:
 * - STATIC: Muestra un PDF del menú (imagen estática)
 * - INTERACTIVE: Menú dinámico con categorías, productos y opcionalmente pedido autónomo
 *
 * Tiene endpoints públicos (sin auth) para que los comensales escaneen el QR,
 * y endpoints de admin (con auth) para gestionar la configuración y los códigos.
 *
 * @module controllers/qr.controller
 */

import { Request, Response } from 'express';
import { qrService } from '../services/qr.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

// ============================================================================
// ENDPOINTS PUBLICOS (Sin autenticación requerida)
// ============================================================================

/**
 * Valida un código QR y devuelve la configuración del menú.
 * GET /api/v1/qr/:code
 * El comensal escanea el QR y este endpoint le indica qué tipo de menú mostrar.
 * Incrementa el contador de escaneos para analíticas.
 */
export const validateQr = asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code as string;

    const data = await qrService.validateAndScan(code);

    sendSuccess(res, data);
});

/**
 * Obtiene el menú público completo para modo INTERACTIVE.
 * GET /api/v1/qr/:code/menu
 * Devuelve categorías y productos con precios para que el comensal navegue el menú.
 * En modo STATIC solo retorna la URL del PDF.
 */
export const getPublicMenu = asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code as string;

    // Validar el QR (sin incrementar el escaneo nuevamente)
    const qr = await qrService.validateAndScan(code);

    if (qr.config.mode === 'STATIC') {
        // Para modo estático, solo retornar la URL del PDF del menú
        sendSuccess(res, {
            mode: 'STATIC',
            pdfUrl: qr.config.pdfUrl,
            businessName: qr.config.businessName,
            bannerUrl: qr.config.bannerUrl,
            theme: qr.config.theme
        });
        return;
    }

    // Para modo interactivo, retornar el menú completo con productos
    const menu = await qrService.getPublicMenu(qr.tenantId);

    sendSuccess(res, {
        mode: 'INTERACTIVE',
        businessName: qr.config.businessName,
        bannerUrl: qr.config.bannerUrl,
        selfOrderEnabled: qr.config.selfOrderEnabled,
        tableId: qr.tableId,
        tableName: qr.tableName,
        theme: qr.config.theme,
        ...menu
    });
});

// ============================================================================
// ENDPOINTS DE ADMINISTRACION (Requieren autenticación)
// ============================================================================

/**
 * Obtiene la configuración del menú QR del tenant.
 * GET /api/v1/admin/qr/config
 * Incluye modo (STATIC/INTERACTIVE), URL de PDF, banner, tema y si permite auto-pedido.
 */
export const getConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await qrService.getConfig(req.user!.tenantId!);
    sendSuccess(res, config);
});

/**
 * Actualiza la configuración del menú QR.
 * PATCH /api/v1/admin/qr/config
 */
export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await qrService.updateConfig(req.user!.tenantId!, req.body);
    sendSuccess(res, config);
});

/**
 * Obtiene todos los códigos QR generados para el tenant.
 * GET /api/v1/admin/qr/codes
 * Incluye información de la mesa asociada y el contador de escaneos.
 */
export const getAllCodes = asyncHandler(async (req: Request, res: Response) => {
    const codes = await qrService.getAllQrCodes(req.user!.tenantId!);
    sendSuccess(res, codes);
});

/**
 * Genera un nuevo código QR opcionalmente vinculado a una mesa.
 * POST /api/v1/admin/qr/codes
 * Si se asocia a una mesa, el menú QR muestra automáticamente el nombre de la mesa.
 */
export const generateCode = asyncHandler(async (req: Request, res: Response) => {
    const { tableId } = req.body;
    const code = await qrService.generateQrCode(req.user!.tenantId!, tableId);
    sendSuccess(res, code, undefined, 201);
});

/**
 * Activa/desactiva un código QR (toggle).
 * PATCH /api/v1/admin/qr/codes/:id/toggle
 * Un QR desactivado no permite acceder al menú.
 */
export const toggleCode = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const code = await qrService.toggleQrCode(id, req.user!.tenantId!);
    sendSuccess(res, code);
});

/**
 * Elimina un código QR permanentemente.
 * DELETE /api/v1/admin/qr/codes/:id
 */
export const deleteCode = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await qrService.deleteQrCode(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'QR code deleted' });
});
