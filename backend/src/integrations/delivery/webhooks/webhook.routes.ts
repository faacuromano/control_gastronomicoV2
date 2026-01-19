/**
 * @fileoverview Webhook Routes
 * 
 * Rutas para recibir webhooks de plataformas de delivery.
 * 
 * IMPORTANTE: Los webhooks deben usar express.raw() para preservar
 * el body original para validación HMAC.
 * 
 * @module integrations/delivery/webhooks/webhook.routes
 */

import { Router, raw } from 'express';
import { webhookController } from './webhook.controller';
import { validateHmac, skipHmacInDevelopment } from './hmac.middleware';

const router = Router();

// ============================================================================
// IMPORTANTE: Webhooks requieren raw body para HMAC
// ============================================================================

/**
 * Ruta genérica para cualquier plataforma.
 * 
 * @route POST /api/v1/webhooks/:platform
 * @example POST /api/v1/webhooks/rappi
 */
router.post(
  '/:platform',
  raw({ type: 'application/json', limit: '1mb' }),
  skipHmacInDevelopment,
  webhookController.handleWebhook.bind(webhookController)
);

/**
 * Health check para webhooks.
 * 
 * @route GET /api/v1/webhooks/health
 */
router.get('/health', webhookController.healthCheck.bind(webhookController));

// ============================================================================
// RUTAS ESPECÍFICAS POR PLATAFORMA (Opcional, para mayor claridad)
// ============================================================================

/**
 * Webhook de Rappi.
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
 * Webhook de Glovo.
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
 * Webhook de PedidosYa.
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
