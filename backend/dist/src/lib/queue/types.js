"use strict";
/**
 * @fileoverview Queue Service Interface and Types
 *
 * Capa de abstracción para el sistema de colas.
 * Permite cambiar de BullMQ a RabbitMQ/SQS sin modificar el código de la aplicación.
 *
 * @module lib/queue/types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETRY_CONFIG = exports.DEFAULT_RETRY_CONFIG = void 0;
// ============================================================================
// CONFIGURACIÓN DE COLA
// ============================================================================
/**
 * Configuración de política de reintentos.
 *
 * RATIONALE: 10 intentos con backoff exponencial
 *
 * | Intento | Delay    | Tiempo Acumulado |
 * |---------|----------|------------------|
 * | 1       | 0s       | 0s               |
 * | 2       | 30s      | 30s              |
 * | 3       | 1m       | 1.5m             |
 * | 4       | 2m       | 3.5m             |
 * | 5       | 4m       | 7.5m             |
 * | 6       | 8m       | 15.5m            |
 * | 7       | 16m      | 31.5m            |
 * | 8       | 32m      | 63.5m (~1h)      |
 * | 9       | 64m      | 127.5m (~2h)     |
 * | 10      | 128m     | 255.5m (~4h)     |
 * | FAIL    | -        | Dead Letter      |
 *
 * ¿Por qué 10 intentos?
 * - Durante un corte de 10 minutos, los primeros 5 intentos cubren hasta 7.5 min
 * - Esto permite recuperarse de la mayoría de cortes de infraestructura
 * - Si después de 4+ horas sigue fallando, es un problema real que requiere intervención
 */
exports.DEFAULT_RETRY_CONFIG = {
    attempts: 10,
    backoff: {
        type: 'exponential',
        delay: 30000, // 30 segundos inicial
    },
};
exports.RETRY_CONFIG = exports.DEFAULT_RETRY_CONFIG;
//# sourceMappingURL=types.js.map