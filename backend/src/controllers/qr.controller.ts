/**
 * @fileoverview QR Menu Controller
 * Handles QR code management and public menu access
 * 
 * @module controllers/qr.controller
 */

import { Request, Response } from 'express';
import { qrService } from '../services/qr.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

// ============================================================================
// PUBLIC ENDPOINTS (No auth required)
// ============================================================================

/**
 * Validate QR code and get menu config
 * GET /api/v1/qr/:code
 */
export const validateQr = asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code as string;
    
    const data = await qrService.validateAndScan(code);
    
    sendSuccess(res, data);
});

/**
 * Get public menu (for INTERACTIVE mode)
 * GET /api/v1/qr/:code/menu
 */
export const getPublicMenu = asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code as string;
    
    // First validate the QR code (but don't increment scan again)
    const qr = await qrService.validateAndScan(code);
    
    if (qr.config.mode === 'STATIC') {
        // For static mode, just return the PDF URL
        sendSuccess(res, {
            mode: 'STATIC',
            pdfUrl: qr.config.pdfUrl,
            businessName: qr.config.businessName,
            bannerUrl: qr.config.bannerUrl,
            theme: qr.config.theme
        });
        return;
    }

    // For interactive mode, return full menu
    const menu = await qrService.getPublicMenu();
    
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
// ADMIN ENDPOINTS (Auth required)
// ============================================================================

/**
 * Get QR menu configuration
 * GET /api/v1/admin/qr/config
 */
export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
    const config = await qrService.getConfig();
    sendSuccess(res, config);
});

/**
 * Update QR menu configuration
 * PATCH /api/v1/admin/qr/config
 */
export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await qrService.updateConfig(req.body);
    sendSuccess(res, config);
});

/**
 * Get all QR codes
 * GET /api/v1/admin/qr/codes
 */
export const getAllCodes = asyncHandler(async (_req: Request, res: Response) => {
    const codes = await qrService.getAllQrCodes();
    sendSuccess(res, codes);
});

/**
 * Generate new QR code
 * POST /api/v1/admin/qr/codes
 */
export const generateCode = asyncHandler(async (req: Request, res: Response) => {
    const { tableId } = req.body;
    const code = await qrService.generateQrCode(tableId);
    sendSuccess(res, code, undefined, 201);
});

/**
 * Toggle QR code active status
 * PATCH /api/v1/admin/qr/codes/:id/toggle
 */
export const toggleCode = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const code = await qrService.toggleQrCode(id);
    sendSuccess(res, code);
});

/**
 * Delete QR code
 * DELETE /api/v1/admin/qr/codes/:id
 */
export const deleteCode = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await qrService.deleteQrCode(id);
    sendSuccess(res, { message: 'QR code deleted' });
});
