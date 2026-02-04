/**
 * @fileoverview Rutas de Configuración del Tenant (Feature Flags)
 *
 * Provee la configuración del tenant al frontend: nombre del negocio,
 * símbolo de moneda y feature flags que controlan qué módulos están
 * habilitados (stock, delivery, KDS, fiscal, digital). Esto permite
 * que cada tenant tenga una experiencia personalizada según su plan
 * de suscripción y necesidades.
 *
 * A diferencia de otras rutas, estas tienen la lógica directamente en
 * el archivo de rutas (inline handlers) en lugar de usar un controller
 * separado, dado que son endpoints simples de lectura/escritura de config.
 *
 * @module routes/config.routes
 */

import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { getTenantConfig, updateTenantConfig } from '../services/featureFlags.service';
import { sendSuccess, sendError } from '../utils/response';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/config
 * Obtiene la configuración del tenant para la UI.
 * Requiere autenticación. Devuelve solo los campos necesarios para el frontend
 * (nombre del negocio, moneda, y feature flags habilitados).
 */
router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
        const config = await getTenantConfig(req.user!.tenantId);

        // Devolver solo los campos necesarios para el frontend
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
        logger.error('Error fetching config:', { error });
        sendError(res, 'CONFIG_ERROR', 'No se pudo cargar la configuración');
    }
});

/**
 * PATCH /api/v1/config
 * Actualiza la configuración del tenant (nombre, moneda, feature flags).
 * Requiere permiso settings:update. El rol ADMIN lo tiene por defecto
 * gracias al bypass de permisos en el middleware de autorización.
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
        logger.error('Error updating config:', { error });
        sendError(res, 'CONFIG_ERROR', 'No se pudo actualizar la configuración');
    }
});

export default router;
