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

import { bullMQService } from './BullMQService';
import type { IQueueService, JobOptions, JobResult, JobHandler } from './types';
import { DEFAULT_RETRY_CONFIG } from './types';

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Factory function para obtener el servicio de colas apropiado.
 * En testing, se podría retornar InMemoryQueueService.
 */
function createQueueService(): IQueueService {
  // En el futuro, aquí se podría elegir entre BullMQ, RabbitMQ, SQS
  // basándose en variables de entorno
  const provider = process.env.QUEUE_PROVIDER || 'bullmq';

  switch (provider) {
    case 'bullmq':
    default:
      return bullMQService;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Instancia singleton del servicio de colas */
export const queueService = createQueueService();

/** Re-exportar tipos para conveniencia */
export type { IQueueService, JobOptions, JobResult, JobHandler };
export { DEFAULT_RETRY_CONFIG };

// ============================================================================
// NOMBRES DE COLAS PREDEFINIDOS
// ============================================================================

/**
 * Nombres de colas estandarizados.
 * Usar estas constantes en lugar de strings hardcoded.
 */
export const QUEUE_NAMES = {
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
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
