/**
 * @fileoverview Delivery Integration Module
 *
 * Punto de entrada principal para el sistema de integraciones de delivery.
 *
 * ESTRUCTURA:
 * - adapters/  → Adaptadores por plataforma (Rappi, Glovo, etc.)
 * - webhooks/  → Recepción y procesamiento de webhooks
 * - jobs/      → Workers para procesamiento asíncrono
 * - types/     → Tipos normalizados comunes
 *
 * @module integrations/delivery
 */
export { AbstractDeliveryAdapter, AdapterFactory, RappiAdapter, } from './adapters';
export type { AdapterConfig, RequestContext } from './adapters';
export { webhookController, webhookRoutes, validateHmac, validateHmacDynamic, skipHmacInDevelopment, } from './webhooks';
export { initWebhookProcessor } from './jobs';
export { menuSyncService, stockSyncService, statusUpdateService } from './sync';
export * from './types/normalized.types';
//# sourceMappingURL=index.d.ts.map