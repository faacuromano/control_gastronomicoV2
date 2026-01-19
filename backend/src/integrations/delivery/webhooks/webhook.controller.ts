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

import type { Request, Response } from 'express';
import { queueService, QUEUE_NAMES } from '../../../lib/queue';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { WebhookEventType, DeliveryPlatformCode } from '../types/normalized.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// TIPOS
// ============================================================================

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
// CONTROLLER
// ============================================================================

class WebhookController {
  /**
   * Handler genérico para webhooks de cualquier plataforma.
   * Detecta la plataforma desde el parámetro de la ruta.
   * 
   * @route POST /api/v1/webhooks/:platform
   */
  async handleWebhook(req: Request, res: Response) {
    const startTime = Date.now();
    const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const platformCode = String(req.params.platform || '').toUpperCase() as DeliveryPlatformCode;

    try {
      // @ts-expect-error - parsedBody viene del HMAC middleware
      const payload = req.parsedBody || req.body;

      // Parsear con el adapter para obtener tipo de evento
      const adapter = await AdapterFactory.getByPlatformCode(platformCode);
      const processedWebhook = adapter.parseWebhookPayload(payload);

      // Construir job data
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

      // Encolar para procesamiento asíncrono
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

      // Responder inmediatamente
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

      // Aún respondemos 200 para evitar reintentos de la plataforma
      // El error se manejará internamente
      return res.status(200).json({
        success: false,
        requestId,
        message: 'Webhook received but processing failed. Will retry internally.',
      });
    }
  }

  /**
   * Handler específico para Rappi.
   * Alias para handleWebhook con platform forzado.
   * 
   * @route POST /api/v1/webhooks/rappi
   */
  async handleRappiWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.RAPPI;
    return this.handleWebhook(req, res);
  }

  /**
   * Handler específico para Glovo.
   * 
   * @route POST /api/v1/webhooks/glovo
   */
  async handleGlovoWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.GLOVO;
    return this.handleWebhook(req, res);
  }

  /**
   * Handler específico para PedidosYa.
   * 
   * @route POST /api/v1/webhooks/pedidosya
   */
  async handlePedidosYaWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.PEDIDOSYA;
    return this.handleWebhook(req, res);
  }

  /**
   * Health check para verificar que los webhooks funcionan.
   * Útil para configurar en las plataformas.
   * 
   * @route GET /api/v1/webhooks/health
   */
  async healthCheck(req: Request, res: Response) {
    const queueHealthy = await queueService.isHealthy();

    return res.status(queueHealthy ? 200 : 503).json({
      status: queueHealthy ? 'healthy' : 'degraded',
      queue: queueHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      availablePlatforms: AdapterFactory.getAvailablePlatformCodes(),
    });
  }
}

export const webhookController = new WebhookController();
