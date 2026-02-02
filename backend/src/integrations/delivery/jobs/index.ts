/**
 * @fileoverview Indice del Modulo de Jobs de Delivery
 *
 * Exporta los procesadores de jobs y la funcion de inicializacion
 * del worker de webhooks. Estos jobs se ejecutan de forma asincrona
 * mediante BullMQ + Redis para garantizar resiliencia y reintentos.
 *
 * @module integrations/delivery/jobs
 */

export { webhookProcessor, initWebhookProcessor } from './webhookProcessor';
