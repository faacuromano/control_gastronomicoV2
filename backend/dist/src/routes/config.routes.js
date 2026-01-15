"use strict";
/**
 * Feature Flags / Config Routes
 * Provides tenant configuration to frontend
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const featureFlags_service_1 = require("../services/featureFlags.service");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/config
 * Get tenant configuration (public parts for UI)
 * Requires authentication
 */
router.get('/config', auth_1.authenticateToken, async (req, res) => {
    try {
        const config = await (0, featureFlags_service_1.getTenantConfig)();
        // Return only necessary fields for frontend
        (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        console.error('Error fetching config:', error);
        (0, response_1.sendError)(res, 'CONFIG_ERROR', 'Could not load configuration');
    }
});
/**
 * PATCH /api/v1/config
 * Update tenant configuration
 * Requires admin role (TODO: implement role check)
 */
router.patch('/config', auth_1.authenticateToken, async (req, res) => {
    try {
        // TODO: Check if user has admin role
        const updates = req.body;
        const config = await (0, featureFlags_service_1.updateTenantConfig)(updates);
        (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        console.error('Error updating config:', error);
        (0, response_1.sendError)(res, 'CONFIG_ERROR', 'Could not update configuration');
    }
});
exports.default = router;
//# sourceMappingURL=config.routes.js.map