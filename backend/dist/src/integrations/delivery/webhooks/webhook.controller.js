"use strict";
/**
 * @fileoverview Webhook Controller
 *
 * Controller para recibir y procesar webhooks de plataformas de delivery.
 * Implementa procesamiento asíncrono via Queue para resiliencia.
 *
 * FLUJO:
 * 1. Recibir webhook (validado por HMAC middleware)
 * 2. Encolar para procesamiento asíncrono
 * 3. Responder 200 OK inmediatamente (< 100ms)
 * 4. Worker procesa y crea/actualiza orden
 *
 * @module integrations/delivery/webhooks/webhook.controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookController = void 0;
const zod_1 = require("zod");
const queue_1 = require("../../../lib/queue");
const AdapterFactory_1 = require("../adapters/AdapterFactory");
const normalized_types_1 = require("../types/normalized.types");
const logger_1 = require("../../../utils/logger");
// ============================================================================
// TIPOS
// ============================================================================
// FIX IP-005: Validate webhook payload schema
const webhookPayloadSchema = zod_1.z.object({
    platform: zod_1.z.string(),
    signature: zod_1.z.string().optional(),
    timestamp: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    body: zod_1.z.any(), // Allow any structure, adapter will validate specifics
});
// ============================================================================
// CONTROLLER
// ============================================================================
class WebhookController {
    /**
     * Handler genérico para webhooks de cualquier plataforma.
     * Detecta la plataforma desde el parámetro de la ruta.
     *
     * @route POST /api/v1/webhooks/:platform
     */
    async handleWebhook(req, res) {
        const startTime = Date.now();
        const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const rawPlatform = String(req.params.platform || '').toUpperCase();
        // FIX IP-002: Validate platform against whitelist to prevent prototype pollution
        const VALID_PLATFORMS = Object.values(normalized_types_1.DeliveryPlatformCode);
        if (!VALID_PLATFORMS.includes(rawPlatform)) {
            logger_1.logger.warn('Unknown delivery platform attempted', {
                requestId,
                rawPlatform,
                ip: req.ip,
            });
            return res.status(400).json({
                error: 'UNKNOWN_PLATFORM',
                message: `Platform "${rawPlatform}" is not supported. Valid: ${VALID_PLATFORMS.join(', ')}`,
                requestId,
            });
        }
        const platformCode = rawPlatform;
        try {
            const payload = req.parsedBody || req.body;
            // FIX IP-005: Validate basic payload structure before processing
            const validation = webhookPayloadSchema.safeParse({
                platform: platformCode,
                signature: req.headers['x-signature'] || req.headers['x-rappi-signature'],
                timestamp: req.headers['x-timestamp'],
                body: payload,
            });
            if (!validation.success) {
                logger_1.logger.warn('Invalid webhook payload structure', {
                    requestId,
                    platform: platformCode,
                    errors: validation.error.issues,
                });
                return res.status(400).json({
                    error: 'INVALID_PAYLOAD',
                    message: 'Webhook payload structure is invalid',
                    details: validation.error.issues,
                    requestId,
                });
            }
            // Parsear con el adapter para obtener tipo de evento
            const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformCode(platformCode);
            const processedWebhook = adapter.parseWebhookPayload(payload);
            // Construir job data
            const ip = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const jobData = {
                platform: platformCode,
                eventType: processedWebhook.eventType,
                externalOrderId: processedWebhook.externalOrderId,
                payload,
                receivedAt: new Date().toISOString(),
                metadata: {
                    ...(ip !== undefined && { ip }),
                    ...(userAgent !== undefined && { userAgent }),
                    requestId,
                },
            };
            // Encolar para procesamiento asíncrono
            const jobId = await queue_1.queueService.enqueue(queue_1.QUEUE_NAMES.DELIVERY_WEBHOOKS, jobData, {
                jobId: `${platformCode}_${processedWebhook.externalOrderId}`,
            });
            const duration = Date.now() - startTime;
            logger_1.logger.info('Webhook enqueued for processing', {
                requestId,
                platform: platformCode,
                eventType: processedWebhook.eventType,
                externalOrderId: processedWebhook.externalOrderId,
                jobId,
                durationMs: duration,
            });
            // Responder inmediatamente
            return res.status(200).json({
                success: true,
                requestId,
                jobId,
                message: 'Webhook received and queued for processing',
            });
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.logger.error('Error handling webhook', {
                requestId,
                platform: platformCode,
                error: error instanceof Error ? error.message : String(error),
                durationMs: duration,
            });
            // FIX ES-003: Return 500 so platform will retry the webhook
            // Previously returned 200 which caused silent order loss
            return res.status(500).json({
                error: 'PROCESSING_FAILED',
                requestId,
                message: 'Internal error processing webhook. Platform should retry.',
            });
        }
    }
    /**
     * Handler específico para Rappi.
     * Alias para handleWebhook con platform forzado.
     *
     * @route POST /api/v1/webhooks/rappi
     */
    async handleRappiWebhook(req, res) {
        req.params.platform = normalized_types_1.DeliveryPlatformCode.RAPPI;
        return this.handleWebhook(req, res);
    }
    /**
     * Handler específico para Glovo.
     *
     * @route POST /api/v1/webhooks/glovo
     */
    async handleGlovoWebhook(req, res) {
        req.params.platform = normalized_types_1.DeliveryPlatformCode.GLOVO;
        return this.handleWebhook(req, res);
    }
    /**
     * Handler específico para PedidosYa.
     *
     * @route POST /api/v1/webhooks/pedidosya
     */
    async handlePedidosYaWebhook(req, res) {
        req.params.platform = normalized_types_1.DeliveryPlatformCode.PEDIDOSYA;
        return this.handleWebhook(req, res);
    }
    /**
     * Health check para verificar que los webhooks funcionan.
     * Útil para configurar en las plataformas.
     *
     * @route GET /api/v1/webhooks/health
     */
    async healthCheck(req, res) {
        const queueHealthy = await queue_1.queueService.isHealthy();
        return res.status(queueHealthy ? 200 : 503).json({
            status: queueHealthy ? 'healthy' : 'degraded',
            queue: queueHealthy ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            availablePlatforms: AdapterFactory_1.AdapterFactory.getAvailablePlatformCodes(),
        });
    }
}
exports.webhookController = new WebhookController();
//# sourceMappingURL=webhook.controller.js.map