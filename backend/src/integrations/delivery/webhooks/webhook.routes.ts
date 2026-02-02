/**
 * @fileoverview Rutas de Webhooks de Delivery
 *
 * Define las rutas Express para recibir webhooks de las plataformas de delivery.
 * Incluye tanto una ruta generica parametrizada como rutas especificas por plataforma.
 *
 * IMPORTANTE: Todas las rutas de webhook DEBEN usar express.raw() en vez de
 * express.json() para preservar el body original como Buffer. Esto es necesario
 * para calcular y verificar la firma HMAC correctamente. Si se usa express.json(),
 * el body se parsea y se pierde la representacion exacta en bytes.
 *
 * CADENA DE MIDDLEWARES:
 * 1. webhookRateLimiter — Previene abuso por exceso de requests (SEC-028)
 * 2. express.raw() — Captura el body como Buffer sin parsear
 * 3. skipHmacInDevelopment / validateHmac — Valida la firma HMAC
 * 4. webhookController — Procesa el webhook y lo encola
 *
 * @module integrations/delivery/webhooks/webhook.routes
 */

import { Router, raw } from 'express';
import { webhookController } from './webhook.controller';
import { validateHmac, skipHmacInDevelopment } from './hmac.middleware';
import { webhookRateLimiter } from '../../../middleware/rateLimit';

const router = Router();

// SEC-028: Aplicar rate limiting a todos los endpoints de webhook
router.use(webhookRateLimiter);

// ============================================================================
// IMPORTANTE: Los webhooks requieren body crudo (Buffer) para validacion HMAC
// ============================================================================

/**
 * Ruta generica para webhooks de cualquier plataforma.
 * La plataforma se detecta dinamicamente desde el parametro de la URL.
 *
 * @route POST /api/v1/webhooks/:platform
 * @example POST /api/v1/webhooks/rappi
 * @example POST /api/v1/webhooks/pedidosya
 */
router.post(
  '/:platform',
  raw({ type: 'application/json', limit: '1mb' }),
  skipHmacInDevelopment,
  webhookController.handleWebhook.bind(webhookController)
);

/**
 * Health check para verificar estado del sistema de webhooks.
 *
 * @route GET /api/v1/webhooks/health
 */
router.get('/health', webhookController.healthCheck.bind(webhookController));

// ============================================================================
// RUTAS ESPECIFICAS POR PLATAFORMA (Opcionales, para mayor claridad en la config)
// ============================================================================

/**
 * Webhook de Rappi con validacion HMAC dedicada.
 *
 * @route POST /api/v1/webhooks/rappi
 */
router.post(
  '/rappi',
  raw({ type: 'application/json', limit: '1mb' }),
  validateHmac('RAPPI'),
  webhookController.handleRappiWebhook.bind(webhookController)
);

/**
 * Webhook de Glovo con validacion HMAC dedicada.
 *
 * @route POST /api/v1/webhooks/glovo
 */
router.post(
  '/glovo',
  raw({ type: 'application/json', limit: '1mb' }),
  validateHmac('GLOVO'),
  webhookController.handleGlovoWebhook.bind(webhookController)
);

/**
 * Webhook de PedidosYa con validacion HMAC dedicada.
 *
 * @route POST /api/v1/webhooks/pedidosya
 */
router.post(
  '/pedidosya',
  raw({ type: 'application/json', limit: '1mb' }),
  validateHmac('PEDIDOSYA'),
  webhookController.handlePedidosYaWebhook.bind(webhookController)
);

export default router;
