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

// Adapters
export { 
  AbstractDeliveryAdapter,
  AdapterFactory,
  RappiAdapter,
} from './adapters';

export type { AdapterConfig, RequestContext } from './adapters';

// Webhooks
export { 
  webhookController,
  webhookRoutes,
  validateHmac,
  validateHmacDynamic,
  skipHmacInDevelopment,
} from './webhooks';

// Jobs
export { initWebhookProcessor } from './jobs';

// Sync Services
export { menuSyncService, stockSyncService, statusUpdateService } from './sync';

// Types
export * from './types/normalized.types';
