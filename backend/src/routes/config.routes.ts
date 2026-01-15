/**
 * Feature Flags / Config Routes
 * Provides tenant configuration to frontend
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
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
        const config = await getTenantConfig();
        
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
 * Requires admin role (TODO: implement role check)
 */
router.patch('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
        // TODO: Check if user has admin role
        const updates = req.body;
        
        const config = await updateTenantConfig(updates);
        
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
