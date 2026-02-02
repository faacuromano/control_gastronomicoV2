/**
 * @fileoverview Modulo Principal de Integraciones de Delivery
 *
 * Punto de entrada principal para todo el sistema de integraciones con
 * plataformas de delivery externas (Rappi, PedidosYa, Glovo, UberEats).
 *
 * ESTRUCTURA DEL MODULO:
 * - adapters/  — Adaptadores concretos por plataforma (patron Adapter + Factory)
 * - webhooks/  — Recepcion, validacion HMAC y procesamiento de webhooks entrantes
 * - jobs/      — Workers BullMQ para procesamiento asincrono de webhooks
 * - sync/      — Servicios de sincronizacion de menu, stock y estados
 * - types/     — Tipos normalizados comunes entre todas las plataformas
 *
 * @module integrations/delivery
 */

// Adaptadores de plataformas
export {
  AbstractDeliveryAdapter,
  AdapterFactory,
  RappiAdapter,
} from './adapters';

export type { AdapterConfig, RequestContext } from './adapters';

// Webhooks — Recepcion y validacion de notificaciones de plataformas
export {
  webhookController,
  webhookRoutes,
  validateHmac,
  validateHmacDynamic,
  skipHmacInDevelopment,
} from './webhooks';

// Jobs — Procesamiento asincrono via BullMQ
export { initWebhookProcessor } from './jobs';

// Servicios de Sincronizacion — Menu, stock y estados con plataformas
export { menuSyncService, stockSyncService, statusUpdateService } from './sync';

// Tipos normalizados compartidos entre todos los componentes
export * from './types/normalized.types';
