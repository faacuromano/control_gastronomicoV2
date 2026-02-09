/**
 * @fileoverview Middleware de Validacion HMAC para Webhooks de Delivery
 *
 * Middleware Express que valida las firmas HMAC de los webhooks entrantes
 * de las plataformas de delivery. Esta es la primera linea de defensa
 * contra la inyeccion de pedidos falsos en el sistema.
 *
 * CRITICO PARA SEGURIDAD: Sin esta validacion, cualquier atacante podria
 * enviar webhooks falsos al endpoint y crear pedidos fraudulentos.
 *
 * FLUJO DE VALIDACION:
 * 1. Leer el body crudo (Buffer, no parseado) — necesario para calcular HMAC
 * 2. Extraer la firma del header correspondiente segun la plataforma
 * 3. Delegar la validacion al adaptador de la plataforma
 * 4. Si es valida: parsear el JSON y continuar al controller
 * 5. Si es invalida: responder 401 Unauthorized y no procesar
 *
 * IMPORTANTE: Las rutas de webhook DEBEN usar express.raw() en vez de
 * express.json() para preservar el body original para el calculo HMAC.
 *
 * @module integrations/delivery/webhooks/hmac.middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { DeliveryPlatformCode } from '../types/normalized.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// MAPEO DE HEADERS DE FIRMA POR PLATAFORMA
// ============================================================================

/**
 * Mapeo de codigo de plataforma al nombre del header HTTP donde envia su firma.
 * Cada plataforma usa un header diferente para transmitir la firma HMAC.
 */
const SIGNATURE_HEADERS: Record<string, string> = {
  [DeliveryPlatformCode.RAPPI]: 'x-rappi-signature',
  [DeliveryPlatformCode.GLOVO]: 'x-glovo-signature',
  [DeliveryPlatformCode.PEDIDOSYA]: 'x-peya-token',
  [DeliveryPlatformCode.UBEREATS]: 'x-uber-signature',
};

// ============================================================================
// MIDDLEWARE DE VALIDACION
// ============================================================================

/**
 * Crea un middleware de validacion HMAC para una plataforma especifica.
 * El middleware verifica que el webhook tenga una firma valida antes de
 * permitir que el controller lo procese.
 *
 * @param platformCode - Codigo de la plataforma (RAPPI, GLOVO, etc.)
 * @returns Middleware Express que valida la firma HMAC
 *
 * @example
 * ```typescript
 * router.post(
 *   '/webhook/rappi',
 *   express.raw({ type: 'application/json' }),  // IMPORTANTE: body crudo
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
      // Paso 1: Obtener la firma del header correspondiente
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

      // Paso 2: Verificar que tenemos el body crudo como Buffer
      // IMPORTANTE: express.raw() debe usarse antes de este middleware
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

      // Paso 3: Obtener el adaptador de la plataforma para validar
      const adapter = await AdapterFactory.getByPlatformCode(platformCode);

      // Paso 4: Validar la firma HMAC
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

      // Paso 5: Parsear el body JSON con proteccion contra JSON bombing (IP-003)
      const rawString = rawBody.toString('utf-8');

      // FIX IP-003: Validar profundidad del JSON antes de parsear para prevenir DoS
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

      // Paso 6: Registrar exito en logs
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
 * Middleware generico que detecta la plataforma desde el parametro de la ruta.
 * Util para rutas como /webhook/:platform donde la plataforma es dinamica.
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

  // Delegar al middleware especifico de la plataforma detectada
  return validateHmac(platformCode)(req, res, next);
}

/**
 * Middleware de bypass para desarrollo local.
 * Permite saltear la validacion HMAC cuando se esta probando localmente
 * sin webhooks reales de las plataformas.
 *
 * NUNCA usar en produccion — tiene un bloqueo explicito que fuerza
 * la validacion HMAC real cuando NODE_ENV es 'production'.
 */
export function skipHmacInDevelopment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // SEC-007 / FIX-007 (CFG-001): Bloquear explicitamente el bypass HMAC en produccion
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SKIP_HMAC_VALIDATION === 'true') {
      logger.error('SKIP_HMAC_VALIDATION is set in production — ignoring and enforcing HMAC validation');
    }
    return validateHmacDynamic(req, res, next);
  }

  if (process.env.SKIP_HMAC_VALIDATION === 'true') {
    logger.warn('HMAC validation SKIPPED (development mode)', {
      ip: req.ip,
      path: req.path,
    });

    // Parsear el body si es un buffer (para que el controller lo pueda usar)
    if (Buffer.isBuffer(req.body)) {
      req.parsedBody = JSON.parse(req.body.toString('utf-8'));
    } else {
      req.parsedBody = req.body;
    }

    return next();
  }

  // Por defecto: siempre validar HMAC
  return validateHmacDynamic(req, res, next);
}
