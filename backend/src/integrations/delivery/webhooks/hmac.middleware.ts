/**
 * @fileoverview HMAC Validation Middleware
 *
 * Middleware to validate HMAC signatures on incoming webhooks.
 * CRITICAL FOR SECURITY: Prevents injection of fake orders.
 *
 * FLOW:
 * 1. Read raw body (buffer, not parsed)
 * 2. Get signature from the appropriate header per platform
 * 3. Validate with the corresponding adapter
 * 4. If valid, continue; if not, 401 Unauthorized
 *
 * @module integrations/delivery/webhooks/hmac.middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { DeliveryPlatformCode } from '../types/normalized.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// CONFIGURACIÓN DE HEADERS POR PLATAFORMA
// ============================================================================

/**
 * Platform-to-signature-header mapping.
 */
const SIGNATURE_HEADERS: Record<string, string> = {
  [DeliveryPlatformCode.RAPPI]: 'x-rappi-signature',
  [DeliveryPlatformCode.GLOVO]: 'x-glovo-signature',
  [DeliveryPlatformCode.PEDIDOSYA]: 'x-py-signature',
  [DeliveryPlatformCode.UBEREATS]: 'x-uber-signature',
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Creates an HMAC validation middleware for a specific platform.
 *
 * @param platformCode - Platform code (RAPPI, GLOVO, etc.)
 * @returns Express middleware
 * 
 * @example
 * ```typescript
 * router.post(
 *   '/webhook/rappi', 
 *   express.raw({ type: 'application/json' }),  // IMPORTANTE: raw body
 *   validateHmac('RAPPI'),
 *   webhookController.handleRappiWebhook
 * );
 * ```
 */
export function validateHmac(platformCode: string) {
  const headerName = SIGNATURE_HEADERS[platformCode.toUpperCase()];

  if (!headerName) {
    throw new Error(`Unknown platform for HMAC validation: ${platformCode}`);
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    try {
      // 1. Get signature from header
      const signature = req.headers[headerName] as string | undefined;

      if (!signature) {
        logger.warn('Webhook received without signature header', {
          platform: platformCode,
          headerExpected: headerName,
          ip: req.ip,
        });
        return res.status(401).json({
          error: 'MISSING_SIGNATURE',
          message: `Missing required header: ${headerName}`,
        });
      }

      // 2. Verify we have the raw body
      // IMPORTANT: express.raw() must be used before this middleware
      const rawBody = req.body as Buffer;

      if (!Buffer.isBuffer(rawBody)) {
        logger.error('Webhook body is not a Buffer - ensure express.raw() is used', {
          platform: platformCode,
          bodyType: typeof req.body,
        });
        return res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Server misconfiguration: raw body required',
        });
      }

      // 3. Get adapter for validation
      const adapter = await AdapterFactory.getByPlatformCode(platformCode);

      // 4. Validar firma
      const isValid = adapter.validateWebhookSignature(signature, rawBody);

      if (!isValid) {
        logger.warn('Webhook signature validation failed', {
          platform: platformCode,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        return res.status(401).json({
          error: 'INVALID_SIGNATURE',
          message: 'Webhook signature validation failed',
        });
      }

      // 5. Parse body for later use with JSON bombing protection (IP-003)
      const rawString = rawBody.toString('utf-8');
      
      // FIX IP-003: Validate JSON depth before parsing to prevent DoS
      const MAX_JSON_DEPTH = 10;
      let depth = 0;
      let maxDepthReached = 0;
      for (const char of rawString) {
        if (char === '{' || char === '[') {
          depth++;
          if (depth > maxDepthReached) maxDepthReached = depth;
          if (depth > MAX_JSON_DEPTH) {
            logger.warn('JSON depth limit exceeded', { platform: platformCode, depth });
            return res.status(400).json({
              error: 'PAYLOAD_TOO_COMPLEX',
              message: 'JSON nesting depth exceeds limit',
            });
          }
        } else if (char === '}' || char === ']') {
          depth--;
        }
      }
      
      req.parsedBody = JSON.parse(rawString);

      // 6. Log success
      const duration = Date.now() - startTime;
      logger.debug('Webhook signature validated', {
        platform: platformCode,
        durationMs: duration,
      });

      return next();
    } catch (error) {
      logger.error('Error in HMAC validation middleware', {
        platform: platformCode,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return res.status(500).json({
        error: 'VALIDATION_ERROR',
        message: 'Internal error during signature validation',
      });
    }
  };
}

/**
 * Generic middleware that detects the platform from the path.
 * For routes like /webhook/:platform
 */
export async function validateHmacDynamic(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const rawPlatform = req.params.platform;
  const platformCode = (
    Array.isArray(rawPlatform) ? rawPlatform[0] ?? '' : rawPlatform ?? ''
  ).toUpperCase();

  if (!platformCode) {
    return res.status(400).json({
      error: 'MISSING_PLATFORM',
      message: 'Platform code is required',
    });
  }

  const headerName = SIGNATURE_HEADERS[platformCode];

  if (!headerName) {
    return res.status(400).json({
      error: 'UNKNOWN_PLATFORM',
      message: `Unknown platform: ${platformCode}`,
      availablePlatforms: Object.keys(SIGNATURE_HEADERS),
    });
  }

  // Delegate to platform-specific middleware
  return validateHmac(platformCode)(req, res, next);
}

/**
 * Bypass middleware for local development.
 * NEVER use in production.
 */
export function skipHmacInDevelopment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // SEC-007: Explicitly block HMAC bypass in production, regardless of env vars
  if (process.env.NODE_ENV === 'production') {
    return validateHmacDynamic(req, res, next);
  }

  if (process.env.SKIP_HMAC_VALIDATION === 'true') {
    logger.warn('HMAC validation SKIPPED (development mode)', {
      ip: req.ip,
      path: req.path,
    });

    // Parse body if it's a buffer
    if (Buffer.isBuffer(req.body)) {
      req.parsedBody = JSON.parse(req.body.toString('utf-8'));
    } else {
      req.parsedBody = req.body;
    }

    return next();
  }

  // Default: always validate
  return validateHmacDynamic(req, res, next);
}
