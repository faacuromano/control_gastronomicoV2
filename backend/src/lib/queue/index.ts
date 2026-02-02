/**
 * @fileoverview Factory y exportaciones del sistema de colas
 *
 * Punto de entrada del sistema de colas. Exporta la implementacion apropiada
 * segun el entorno (BullMQ en produccion, potencialmente InMemory en tests).
 *
 * Este patron Factory permite cambiar el proveedor de colas (ej: de BullMQ
 * a RabbitMQ o AWS SQS) sin modificar el codigo de la aplicacion, ya que
 * todos los consumidores dependen de la interfaz IQueueService.
 *
 * USO:
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

// CFG-010: Proveedores de cola soportados.
// Por ahora solo BullMQ, pero el sistema esta preparado para agregar mas.
const SUPPORTED_PROVIDERS = ['bullmq'] as const;

/**
 * Funcion factory que retorna el servicio de colas apropiado.
 * En testing, podria retornar un InMemoryQueueService que no necesita Redis.
 * El proveedor se selecciona via la variable de entorno QUEUE_PROVIDER.
 */
function createQueueService(): IQueueService {
  const provider = process.env.QUEUE_PROVIDER || 'bullmq';

  if (!SUPPORTED_PROVIDERS.includes(provider as typeof SUPPORTED_PROVIDERS[number])) {
    throw new Error(`Invalid QUEUE_PROVIDER: "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }

  switch (provider) {
    case 'bullmq':
    default:
      return bullMQService;
  }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

/** Instancia singleton del servicio de colas */
export const queueService = createQueueService();

/** Re-exportar tipos para conveniencia de los consumidores */
export type { IQueueService, JobOptions, JobResult, JobHandler };
export { DEFAULT_RETRY_CONFIG };

// ============================================================================
// NOMBRES DE COLAS PREDEFINIDOS
// ============================================================================

/**
 * Nombres estandarizados de colas.
 * Usar estas constantes en lugar de strings hardcodeados para evitar typos
 * y facilitar la busqueda de referencias en el codigo.
 */
export const QUEUE_NAMES = {
  /** Procesar webhooks de plataformas de delivery (Rappi, PedidosYa, Glovo) */
  DELIVERY_WEBHOOKS: 'delivery:webhooks',
  /** Sincronizar menu hacia plataformas externas */
  MENU_SYNC: 'delivery:menu-sync',
  /** Sincronizar stock hacia plataformas externas */
  STOCK_SYNC: 'delivery:stock-sync',
  /** Notificaciones push a usuarios */
  NOTIFICATIONS: 'notifications',
  /** Generacion de reportes en segundo plano */
  REPORTS: 'reports',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
