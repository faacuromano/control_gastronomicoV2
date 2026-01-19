"use strict";
/**
 * @fileoverview Queue Service Factory & Exports
 *
 * Punto de entrada para el sistema de colas.
 * Exporta la implementación apropiada según el entorno.
 *
 * USAGE:
 *   import { queueService } from '../lib/queue';
 *   await queueService.enqueue('webhooks', { orderId: 123 });
 *
 * @module lib/queue
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_NAMES = exports.DEFAULT_RETRY_CONFIG = exports.queueService = void 0;
const BullMQService_1 = require("./BullMQService");
const types_1 = require("./types");
Object.defineProperty(exports, "DEFAULT_RETRY_CONFIG", { enumerable: true, get: function () { return types_1.DEFAULT_RETRY_CONFIG; } });
// ============================================================================
// FACTORY
// ============================================================================
/**
 * Factory function para obtener el servicio de colas apropiado.
 * En testing, se podría retornar InMemoryQueueService.
 */
function createQueueService() {
    // En el futuro, aquí se podría elegir entre BullMQ, RabbitMQ, SQS
    // basándose en variables de entorno
    const provider = process.env.QUEUE_PROVIDER || 'bullmq';
    switch (provider) {
        case 'bullmq':
        default:
            return BullMQService_1.bullMQService;
    }
}
// ============================================================================
// EXPORTS
// ============================================================================
/** Instancia singleton del servicio de colas */
exports.queueService = createQueueService();
// ============================================================================
// NOMBRES DE COLAS PREDEFINIDOS
// ============================================================================
/**
 * Nombres de colas estandarizados.
 * Usar estas constantes en lugar de strings hardcoded.
 */
exports.QUEUE_NAMES = {
    /** Procesar webhooks de plataformas de delivery */
    DELIVERY_WEBHOOKS: 'delivery:webhooks',
    /** Sincronizar menú a plataformas externas */
    MENU_SYNC: 'delivery:menu-sync',
    /** Sincronizar stock a plataformas externas */
    STOCK_SYNC: 'delivery:stock-sync',
    /** Notificaciones push a usuarios */
    NOTIFICATIONS: 'notifications',
    /** Generación de reportes en background */
    REPORTS: 'reports',
};
//# sourceMappingURL=index.js.map