"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_controller_1 = require("./webhook.controller");
const hmac_middleware_1 = require("./hmac.middleware");
const router = (0, express_1.Router)();
// ============================================================================
// IMPORTANTE: Webhooks requieren raw body para HMAC
// ============================================================================
/**
 * Ruta genérica para cualquier plataforma.
 *
 * @route POST /api/v1/webhooks/:platform
 * @example POST /api/v1/webhooks/rappi
 */
router.post('/:platform', (0, express_1.raw)({ type: 'application/json', limit: '1mb' }), hmac_middleware_1.skipHmacInDevelopment, webhook_controller_1.webhookController.handleWebhook.bind(webhook_controller_1.webhookController));
/**
 * Health check para webhooks.
 *
 * @route GET /api/v1/webhooks/health
 */
router.get('/health', webhook_controller_1.webhookController.healthCheck.bind(webhook_controller_1.webhookController));
// ============================================================================
// RUTAS ESPECÍFICAS POR PLATAFORMA (Opcional, para mayor claridad)
// ============================================================================
/**
 * Webhook de Rappi.
 *
 * @route POST /api/v1/webhooks/rappi
 */
router.post('/rappi', (0, express_1.raw)({ type: 'application/json', limit: '1mb' }), (0, hmac_middleware_1.validateHmac)('RAPPI'), webhook_controller_1.webhookController.handleRappiWebhook.bind(webhook_controller_1.webhookController));
/**
 * Webhook de Glovo.
 *
 * @route POST /api/v1/webhooks/glovo
 */
router.post('/glovo', (0, express_1.raw)({ type: 'application/json', limit: '1mb' }), (0, hmac_middleware_1.validateHmac)('GLOVO'), webhook_controller_1.webhookController.handleGlovoWebhook.bind(webhook_controller_1.webhookController));
/**
 * Webhook de PedidosYa.
 *
 * @route POST /api/v1/webhooks/pedidosya
 */
router.post('/pedidosya', (0, express_1.raw)({ type: 'application/json', limit: '1mb' }), (0, hmac_middleware_1.validateHmac)('PEDIDOSYA'), webhook_controller_1.webhookController.handlePedidosYaWebhook.bind(webhook_controller_1.webhookController));
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map