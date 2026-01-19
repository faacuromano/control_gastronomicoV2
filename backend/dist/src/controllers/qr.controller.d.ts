/**
 * @fileoverview QR Menu Controller
 * Handles QR code management and public menu access
 *
 * @module controllers/qr.controller
 */
import { Request, Response } from 'express';
/**
 * Validate QR code and get menu config
 * GET /api/v1/qr/:code
 */
export declare const validateQr: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get public menu (for INTERACTIVE mode)
 * GET /api/v1/qr/:code/menu
 */
export declare const getPublicMenu: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get QR menu configuration
 * GET /api/v1/admin/qr/config
 */
export declare const getConfig: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update QR menu configuration
 * PATCH /api/v1/admin/qr/config
 */
export declare const updateConfig: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get all QR codes
 * GET /api/v1/admin/qr/codes
 */
export declare const getAllCodes: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Generate new QR code
 * POST /api/v1/admin/qr/codes
 */
export declare const generateCode: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Toggle QR code active status
 * PATCH /api/v1/admin/qr/codes/:id/toggle
 */
export declare const toggleCode: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Delete QR code
 * DELETE /api/v1/admin/qr/codes/:id
 */
export declare const deleteCode: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=qr.controller.d.ts.map