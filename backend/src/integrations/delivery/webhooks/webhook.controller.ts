/**
 * @fileoverview Webhook Controller
 *
 * Controller to receive and process webhooks from delivery platforms.
 * Implements async processing via Queue for resilience.
 *
 * FLOW:
 * 1. Receive webhook (validated by HMAC middleware)
 * 2. Enqueue for async processing
 * 3. Respond 200 OK immediately (< 100ms)
 * 4. Worker processes and creates/updates order
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
// TIPOS
// ============================================================================

// FIX IP-005: Validate webhook payload schema
const webhookPayloadSchema = z.object({
  platform: z.string(),
  signature: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  body: z.any(), // Allow any structure, adapter will validate specifics
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
// CONTROLLER
// ============================================================================

class WebhookController {
  /**
   * Generic handler for webhooks from any platform.
   * Detects the platform from the route parameter.
   * 
   * @route POST /api/v1/webhooks/:platform
   */
  async handleWebhook(req: Request, res: Response) {
    const startTime = Date.now();
    const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rawPlatform = String(req.params.platform || '').toUpperCase();

    // FIX IP-002: Validate platform against whitelist to prevent prototype pollution
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

      // FIX IP-005: Validate basic payload structure before processing
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

      // Parse with adapter to get event type
      const adapter = await AdapterFactory.getByPlatformCode(platformCode);
      const processedWebhook = adapter.parseWebhookPayload(payload);

      // Build job data
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

      // Enqueue for async processing
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

      // Respond immediately
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

      // Differentiate client errors (400 - don't retry) from server errors (500 - retry)
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
   * Rappi-specific handler.
   * Alias for handleWebhook with forced platform.
   * 
   * @route POST /api/v1/webhooks/rappi
   */
  async handleRappiWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.RAPPI;
    return this.handleWebhook(req, res);
  }

  /**
   * Glovo-specific handler.
   * 
   * @route POST /api/v1/webhooks/glovo
   */
  async handleGlovoWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.GLOVO;
    return this.handleWebhook(req, res);
  }

  /**
   * PedidosYa-specific handler.
   * 
   * @route POST /api/v1/webhooks/pedidosya
   */
  async handlePedidosYaWebhook(req: Request, res: Response) {
    req.params.platform = DeliveryPlatformCode.PEDIDOSYA;
    return this.handleWebhook(req, res);
  }

  /**
   * Health check to verify webhooks are working.
   * Useful for platform configuration.
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
