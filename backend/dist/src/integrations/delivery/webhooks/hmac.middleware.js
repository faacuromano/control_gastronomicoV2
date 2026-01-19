"use strict";
/**
 * @fileoverview HMAC Validation Middleware
 *
 * Middleware para validar firmas HMAC de webhooks entrantes.
 * CRÍTICO PARA SEGURIDAD: Previene inyección de pedidos falsos.
 *
 * FLUJO:
 * 1. Leer raw body (buffer, no parseado)
 * 2. Obtener signature del header apropiado según plataforma
 * 3. Validar con el adapter correspondiente
 * 4. Si válido, continuar; si no, 401 Unauthorized
 *
 * @module integrations/delivery/webhooks/hmac.middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateHmac = validateHmac;
exports.validateHmacDynamic = validateHmacDynamic;
exports.skipHmacInDevelopment = skipHmacInDevelopment;
const AdapterFactory_1 = require("../adapters/AdapterFactory");
const normalized_types_1 = require("../types/normalized.types");
const logger_1 = require("../../../utils/logger");
// ============================================================================
// CONFIGURACIÓN DE HEADERS POR PLATAFORMA
// ============================================================================
/**
 * Mapeo de plataformas a sus headers de firma.
 */
const SIGNATURE_HEADERS = {
    [normalized_types_1.DeliveryPlatformCode.RAPPI]: 'x-rappi-signature',
    [normalized_types_1.DeliveryPlatformCode.GLOVO]: 'x-glovo-signature',
    [normalized_types_1.DeliveryPlatformCode.PEDIDOSYA]: 'x-py-signature',
    [normalized_types_1.DeliveryPlatformCode.UBEREATS]: 'x-uber-signature',
};
// ============================================================================
// MIDDLEWARE
// ============================================================================
/**
 * Crea un middleware de validación HMAC para una plataforma específica.
 *
 * @param platformCode - Código de la plataforma (RAPPI, GLOVO, etc.)
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
function validateHmac(platformCode) {
    const headerName = SIGNATURE_HEADERS[platformCode.toUpperCase()];
    if (!headerName) {
        throw new Error(`Unknown platform for HMAC validation: ${platformCode}`);
    }
    return async (req, res, next) => {
        const startTime = Date.now();
        try {
            // 1. Obtener firma del header
            const signature = req.headers[headerName];
            if (!signature) {
                logger_1.logger.warn('Webhook received without signature header', {
                    platform: platformCode,
                    headerExpected: headerName,
                    ip: req.ip,
                });
                return res.status(401).json({
                    error: 'MISSING_SIGNATURE',
                    message: `Missing required header: ${headerName}`,
                });
            }
            // 2. Verificar que tenemos el raw body
            // IMPORTANTE: Se debe usar express.raw() antes de este middleware
            const rawBody = req.body;
            if (!Buffer.isBuffer(rawBody)) {
                logger_1.logger.error('Webhook body is not a Buffer - ensure express.raw() is used', {
                    platform: platformCode,
                    bodyType: typeof req.body,
                });
                return res.status(500).json({
                    error: 'INTERNAL_ERROR',
                    message: 'Server misconfiguration: raw body required',
                });
            }
            // 3. Obtener adapter para validar
            const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformCode(platformCode);
            // 4. Validar firma
            const isValid = adapter.validateWebhookSignature(signature, rawBody);
            if (!isValid) {
                logger_1.logger.warn('Webhook signature validation failed', {
                    platform: platformCode,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                });
                return res.status(401).json({
                    error: 'INVALID_SIGNATURE',
                    message: 'Webhook signature validation failed',
                });
            }
            // 5. Parsear body para uso posterior con protección contra JSON bombing (IP-003)
            const rawString = rawBody.toString('utf-8');
            // FIX IP-003: Validate JSON depth before parsing to prevent DoS
            const MAX_JSON_DEPTH = 10;
            let depth = 0;
            let maxDepthReached = 0;
            for (const char of rawString) {
                if (char === '{' || char === '[') {
                    depth++;
                    if (depth > maxDepthReached)
                        maxDepthReached = depth;
                    if (depth > MAX_JSON_DEPTH) {
                        logger_1.logger.warn('JSON depth limit exceeded', { platform: platformCode, depth });
                        return res.status(400).json({
                            error: 'PAYLOAD_TOO_COMPLEX',
                            message: 'JSON nesting depth exceeds limit',
                        });
                    }
                }
                else if (char === '}' || char === ']') {
                    depth--;
                }
            }
            req.parsedBody = JSON.parse(rawString);
            // 6. Log de éxito
            const duration = Date.now() - startTime;
            logger_1.logger.debug('Webhook signature validated', {
                platform: platformCode,
                durationMs: duration,
            });
            return next();
        }
        catch (error) {
            logger_1.logger.error('Error in HMAC validation middleware', {
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
 * Middleware genérico que detecta la plataforma desde el path.
 * Para rutas como /webhook/:platform
 */
async function validateHmacDynamic(req, res, next) {
    const rawPlatform = req.params.platform;
    const platformCode = (Array.isArray(rawPlatform) ? rawPlatform[0] ?? '' : rawPlatform ?? '').toUpperCase();
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
    // Delegar al middleware específico
    return validateHmac(platformCode)(req, res, next);
}
/**
 * Middleware de bypass para desarrollo local.
 * NUNCA usar en producción.
 */
function skipHmacInDevelopment(req, res, next) {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_HMAC_VALIDATION === 'true') {
        logger_1.logger.warn('HMAC validation SKIPPED (development mode)', {
            ip: req.ip,
            path: req.path,
        });
        // Parsear body si es buffer
        if (Buffer.isBuffer(req.body)) {
            req.parsedBody = JSON.parse(req.body.toString('utf-8'));
        }
        else {
            req.parsedBody = req.body;
        }
        return next();
    }
    // En producción, SIEMPRE validar
    return validateHmacDynamic(req, res, next);
}
//# sourceMappingURL=hmac.middleware.js.map