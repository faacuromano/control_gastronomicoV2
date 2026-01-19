"use strict";
/**
 * @fileoverview Abstract Delivery Adapter
 *
 * Clase base abstracta que define el contrato para todas las integraciones
 * de plataformas de delivery (Rappi, Glovo, PedidosYa, UberEats).
 *
 * PATRONES UTILIZADOS:
 * - Template Method: Define el flujo, subclases implementan detalles
 * - Adapter Pattern: Normaliza APIs externas dispares a interfaz común
 *
 * RESPONSABILIDADES:
 * 1. Validar webhooks entrantes (HMAC)
 * 2. Parsear payloads a formato normalizado
 * 3. Enviar actualizaciones de estado a plataforma
 * 4. Sincronizar menú y disponibilidad
 *
 * @module integrations/delivery/adapters/AbstractDeliveryAdapter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractDeliveryAdapter = void 0;
const logger_1 = require("../../../utils/logger");
// ============================================================================
// CLASE ABSTRACTA
// ============================================================================
/**
 * Adapter abstracto para plataformas de delivery.
 *
 * Subclases deben implementar:
 * - validateWebhookSignature()
 * - parseWebhookPayload()
 * - acceptOrder()
 * - rejectOrder()
 * - updateOrderStatus()
 * - pushMenu()
 * - updateProductAvailability()
 *
 * @example
 * ```typescript
 * class RappiAdapter extends AbstractDeliveryAdapter {
 *   protected get platformCode() { return DeliveryPlatformCode.RAPPI; }
 *   // ... implementar métodos abstractos
 * }
 * ```
 */
class AbstractDeliveryAdapter {
    config;
    platform;
    constructor(platform, config = {}) {
        this.platform = platform;
        this.config = {
            platformId: platform.id,
            platformCode: platform.code,
            apiKey: platform.apiKey || '',
            webhookSecret: platform.webhookSecret || '',
            storeId: platform.storeId || '',
            baseUrl: this.getDefaultBaseUrl(),
            timeout: 30000,
            ...config,
        };
        this.validateConfig();
    }
    // ============================================================================
    // MÉTODOS COMUNES (Heredados por subclases)
    // ============================================================================
    /**
     * Valida la configuración del adapter.
     * @throws Error si falta configuración crítica
     */
    validateConfig() {
        if (!this.config.webhookSecret) {
            logger_1.logger.warn('Adapter initialized without webhook secret', {
                platform: this.platformCode,
                platformId: this.config.platformId,
            });
        }
        if (!this.config.apiKey) {
            logger_1.logger.warn('Adapter initialized without API key', {
                platform: this.platformCode,
                platformId: this.config.platformId,
            });
        }
    }
    /**
     * Obtiene el nombre para logging.
     */
    getName() {
        return `${this.platformCode}Adapter`;
    }
    /**
     * Obtiene el ID de la plataforma.
     */
    getPlatformId() {
        return this.config.platformId;
    }
    /**
     * Verifica si el adapter está completamente configurado.
     */
    isConfigured() {
        return !!(this.config.apiKey &&
            this.config.webhookSecret &&
            this.config.storeId);
    }
    /**
     * Log helper con contexto de plataforma.
     */
    log(level, message, meta = {}) {
        logger_1.logger[level](message, {
            platform: this.platformCode,
            platformId: this.config.platformId,
            ...meta,
        });
    }
    /**
     * Helper para calcular HMAC.
     * Las subclases pueden usar esto para sus implementaciones específicas.
     */
    computeHmac(body, secret, algorithm = 'sha256') {
        const crypto = require('crypto');
        return crypto
            .createHmac(algorithm, secret)
            .update(body)
            .digest('hex');
    }
    /**
     * Compara de forma segura dos strings (timing-safe).
     * CRÍTICO para evitar timing attacks en validación HMAC.
     */
    timingSafeEqual(a, b) {
        const crypto = require('crypto');
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) {
            return false;
        }
        return crypto.timingSafeEqual(bufA, bufB);
    }
}
exports.AbstractDeliveryAdapter = AbstractDeliveryAdapter;
//# sourceMappingURL=AbstractDeliveryAdapter.js.map