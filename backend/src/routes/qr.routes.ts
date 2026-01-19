/**
 * @fileoverview QR Menu Routes
 * Public and admin routes for QR code functionality
 * 
 * @module routes/qr.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as qrController from '../controllers/qr.controller';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (No auth required)
// These are accessed by customers scanning QR codes
// ============================================================================

// Validate QR and get config
router.get('/:code', qrController.validateQr);

// Get menu for QR code
router.get('/:code/menu', qrController.getPublicMenu);

// ============================================================================
// ADMIN ROUTES (Auth required)
// ============================================================================

const adminRouter = Router();
adminRouter.use(authenticate);

// Config management
adminRouter.get('/config', qrController.getConfig);
adminRouter.patch('/config', requirePermission('settings', 'update'), qrController.updateConfig);

// QR code management
adminRouter.get('/codes', qrController.getAllCodes);
adminRouter.post('/codes', requirePermission('settings', 'update'), qrController.generateCode);
adminRouter.patch('/codes/:id/toggle', requirePermission('settings', 'update'), qrController.toggleCode);
adminRouter.delete('/codes/:id', requirePermission('settings', 'update'), qrController.deleteCode);

export { router as qrPublicRouter, adminRouter as qrAdminRouter };
