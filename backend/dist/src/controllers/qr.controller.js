"use strict";
/**
 * @fileoverview QR Menu Controller
 * Handles QR code management and public menu access
 *
 * @module controllers/qr.controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCode = exports.toggleCode = exports.generateCode = exports.getAllCodes = exports.updateConfig = exports.getConfig = exports.getPublicMenu = exports.validateQr = void 0;
const qr_service_1 = require("../services/qr.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const response_1 = require("../utils/response");
// ============================================================================
// PUBLIC ENDPOINTS (No auth required)
// ============================================================================
/**
 * Validate QR code and get menu config
 * GET /api/v1/qr/:code
 */
exports.validateQr = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const code = req.params.code;
    const data = await qr_service_1.qrService.validateAndScan(code);
    (0, response_1.sendSuccess)(res, data);
});
/**
 * Get public menu (for INTERACTIVE mode)
 * GET /api/v1/qr/:code/menu
 */
exports.getPublicMenu = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const code = req.params.code;
    // First validate the QR code (but don't increment scan again)
    const qr = await qr_service_1.qrService.validateAndScan(code);
    if (qr.config.mode === 'STATIC') {
        // For static mode, just return the PDF URL
        (0, response_1.sendSuccess)(res, {
            mode: 'STATIC',
            pdfUrl: qr.config.pdfUrl,
            businessName: qr.config.businessName,
            bannerUrl: qr.config.bannerUrl,
            theme: qr.config.theme
        });
        return;
    }
    // For interactive mode, return full menu
    const menu = await qr_service_1.qrService.getPublicMenu();
    (0, response_1.sendSuccess)(res, {
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
exports.getConfig = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const config = await qr_service_1.qrService.getConfig();
    (0, response_1.sendSuccess)(res, config);
});
/**
 * Update QR menu configuration
 * PATCH /api/v1/admin/qr/config
 */
exports.updateConfig = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const config = await qr_service_1.qrService.updateConfig(req.body);
    (0, response_1.sendSuccess)(res, config);
});
/**
 * Get all QR codes
 * GET /api/v1/admin/qr/codes
 */
exports.getAllCodes = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const codes = await qr_service_1.qrService.getAllQrCodes();
    (0, response_1.sendSuccess)(res, codes);
});
/**
 * Generate new QR code
 * POST /api/v1/admin/qr/codes
 */
exports.generateCode = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tableId } = req.body;
    const code = await qr_service_1.qrService.generateQrCode(tableId);
    (0, response_1.sendSuccess)(res, code, undefined, 201);
});
/**
 * Toggle QR code active status
 * PATCH /api/v1/admin/qr/codes/:id/toggle
 */
exports.toggleCode = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const code = await qr_service_1.qrService.toggleQrCode(id);
    (0, response_1.sendSuccess)(res, code);
});
/**
 * Delete QR code
 * DELETE /api/v1/admin/qr/codes/:id
 */
exports.deleteCode = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await qr_service_1.qrService.deleteQrCode(id);
    (0, response_1.sendSuccess)(res, { message: 'QR code deleted' });
});
//# sourceMappingURL=qr.controller.js.map