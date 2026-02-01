/**
 * Feature Flags / Config Routes
 * Provides tenant configuration to frontend
 */

import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { getTenantConfig, updateTenantConfig } from '../services/featureFlags.service';
import { sendSuccess, sendError } from '../utils/response';
import { Request, Response } from 'express';

const router = Router();

/**
 * GET /api/v1/config
 * Get tenant configuration (public parts for UI)
 * Requires authentication
 */
router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
        const config = await getTenantConfig(req.user!.tenantId);

        // Return only necessary fields for frontend
        sendSuccess(res, {
            businessName: config.businessName,
            currencySymbol: config.currencySymbol,
            features: {
                enableStock: config.enableStock,
                enableDelivery: config.enableDelivery,
                enableKDS: config.enableKDS,
                enableFiscal: config.enableFiscal,
                enableDigital: config.enableDigital
            }
        });
    } catch (error) {
        console.error('Error fetching config:', error);
        sendError(res, 'CONFIG_ERROR', 'Could not load configuration');
    }
});

/**
 * PATCH /api/v1/config
 * Update tenant configuration
 * Requires settings:update permission (admin role bypasses)
 */
router.patch('/config', authenticateToken, requirePermission('settings', 'update'), async (req: Request, res: Response) => {
    try {
        const updates = req.body;
        
        const config = await updateTenantConfig(updates, req.user!.tenantId);
        
        sendSuccess(res, {
            businessName: config.businessName,
            currencySymbol: config.currencySymbol,
            features: {
                enableStock: config.enableStock,
                enableDelivery: config.enableDelivery,
                enableKDS: config.enableKDS,
                enableFiscal: config.enableFiscal,
                enableDigital: config.enableDigital
            }
        });
    } catch (error) {
        console.error('Error updating config:', error);
        sendError(res, 'CONFIG_ERROR', 'Could not update configuration');
    }
});

export default router;
