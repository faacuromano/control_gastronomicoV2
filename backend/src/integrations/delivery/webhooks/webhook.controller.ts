/**
 * @fileoverview Controlador de Webhooks de Delivery
 *
 * Controlador Express que recibe y procesa los webhooks entrantes de las
 * plataformas de delivery. Implementa el patron de procesamiento asincrono
 * via cola (BullMQ) para garantizar resiliencia y tiempo de respuesta rapido.
 *
 * FLUJO DE PROCESAMIENTO:
 * 1. Recibir el webhook (ya validado por el middleware HMAC)
 * 2. Validar la estructura basica del payload con Zod
 * 3. Parsear con el adaptador para determinar tipo de evento y extraer datos
 * 4. Encolar el job en BullMQ para procesamiento asincrono
 * 5. Responder 200 OK inmediatamente (< 100ms) para cumplir con los SLA de las plataformas
 * 6. El worker (webhookProcessor) procesa el job y crea/actualiza la orden
 *
 * RAZON DEL PROCESAMIENTO ASINCRONO:
 * Las plataformas de delivery tienen timeouts estrictos para webhooks (tipicamente 5s).
 * Si la respuesta tarda mas, reintentaran el webhook, causando duplicados.
 * Al encolar inmediatamente y responder 200 OK, evitamos este problema.
 *
 * @module integrations/delivery/webhooks/webhook.controller
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { queueService, QUEUE_NAMES } from '../../../lib/queue';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { WebhookEventType, DeliveryPlatformCode } from '../types/normalized.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// TIPOS Y VALIDACION
// ============================================================================

// FIX IP-005: Validar estructura basica del payload del webhook con Zod
const webhookPayloadSchema = z.object({
  platform: z.string(),
  signature: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  body: z.any(), // Permitir cualquier estructura, el adaptador valida los detalles
});

interface WebhookJobData {
  platform: DeliveryPlatformCode;
  eventType: WebhookEventType;
  externalOrderId: string;
  payload: unknown;
  receivedAt: string;
  metadata: {
    ip?: string;
    userAgent?: string;
    requestId: string;
  };
}

// ============================================================================
// CONTROLADOR
// ============================================================================

class WebhookController {
  /**
   * Handler generico para webhooks de cualquier plataforma.
   * Detecta la plataforma desde el parametro de la ruta (:platform).
   * Valida, parsea, encola y responde inmediatamente.
   *
   * @route POST /api/v1/webhooks/:platform
   */
  async handleWebhook(req: Request, res: Response) {
    const startTime = Date.now();
    const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rawPlatform = String(req.params.platform || '').toUpperCase();

    // FIX IP-002: Validar plataforma contra whitelist para prevenir prototype pollution
    const VALID_PLATFORMS: readonly string[] = Object.values(DeliveryPlatformCode);
    if (!VALID_PLATFORMS.includes(rawPlatform)) {
      logger.warn('Unknown delivery platform attempted', {
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
    const platformCode = rawPlatform as DeliveryPlatformCode;

    try {
      const payload = req.parsedBody || req.body;

      // FIX IP-005: Validar estructura basica del payload antes de procesarlo
      const validation = webhookPayloadSchema.safeParse({
        platform: platformCode,
        signature: req.headers['x-signature'] || req.headers['x-rappi-signature'],
        timestamp: req.headers['x-timestamp'],
        body: payload,
      });

      if (!validation.success) {
        logger.warn('Invalid webhook payload structure', {
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

      // Parsear con el adaptador para obtener tipo de evento e ID del pedido
      const adapter = await AdapterFactory.getByPlatformCode(platformCode);
      const processedWebhook = adapter.parseWebhookPayload(payload);

      // Construir datos del job para la cola
      const ip = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const jobData: WebhookJobData = {
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

      // Encolar para procesamiento asincrono via BullMQ
      const jobId = await queueService.enqueue(
        QUEUE_NAMES.DELIVERY_WEBHOOKS,
        jobData,
        {
          jobId: `${platformCode}_${processedWebhook.externalOrderId}`,
        }
      );

      const duration = Date.now() - startTime;

      logger.info('Webhook enqueued for processing', {
        requestId,
        platform: platformCode,
        eventType: processedWebhook.eventType,
        externalOrderId: processedWebhook.externalOrderId,
        jobId,
        durationMs: duration,
      });

      // Responder inmediatamente para cumplir con los SLA de las plataformas
      return res.status(200).json({
        success: true,
        requestId,
        jobId,
        message: 'Webhook received and queued for processing',
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error handling webhook', {
        requestId,
        platform: platformCode,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
      });

      // Diferenciar errores del cliente (400 — no reintentar) de errores del servidor (500 — reintentar)
      const isClientError = error instanceof z.ZodError
        || (error instanceof Error && error.message.includes('Invalid'))
        || (error instanceof Error && error.message.includes('not found'));

      if (isClientError) {
        return res.status(400).json({
          error: 'INVALID_PAYLOAD',
          requestId,
          message: 'Invalid webhook payload. Do not retry.',
        });
      }

      return res.status(500).json({
        error: 'PROCESSING_FAILED',
        requestId,
        message: 'Internal error processing webhook. Platform should retry.',
      });
    }
  }

  /**
   * Handler especifico para webhooks de Rappi.
   * Alias que fuerza la plataforma a RAPPI y delega al handler generico.
   *
   * @route POST /api/v1/webhooks/rappi
   */
  async handleRappiWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.RAPPI;
    return this.handleWebhook(req, res);
  }

  /**
   * Handler especifico para webhooks de Glovo.
   *
   * @route POST /api/v1/webhooks/glovo
   */
  async handleGlovoWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.GLOVO;
    return this.handleWebhook(req, res);
  }

  /**
   * Handler especifico para webhooks de PedidosYa.
   *
   * @route POST /api/v1/webhooks/pedidosya
   */
  async handlePedidosYaWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.PEDIDOSYA;
    return this.handleWebhook(req, res);
  }

  /**
   * Health check para verificar que el sistema de webhooks esta operativo.
   * Verifica la conexion a Redis (cola) y que los workers esten activos.
   * Util para que las plataformas configuren su endpoint de monitoreo.
   *
   * @route GET /api/v1/webhooks/health
   */
  async healthCheck(req: Request, res: Response) {
    const queueHealthy = await queueService.isHealthy();
    const workersActive = queueService.hasActiveWorkers();
    const fullyHealthy = queueHealthy && workersActive;

    return res.status(fullyHealthy ? 200 : 503).json({
      status: fullyHealthy ? 'healthy' : 'degraded',
      queue: queueHealthy ? 'connected' : 'disconnected',
      workers: workersActive ? 'running' : 'stopped',
      timestamp: new Date().toISOString(),
      availablePlatforms: AdapterFactory.getAvailablePlatformCodes(),
    });
  }
}

export const webhookController = new WebhookController();
