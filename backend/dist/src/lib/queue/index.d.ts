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
import type { IQueueService, JobOptions, JobResult, JobHandler } from './types';
import { DEFAULT_RETRY_CONFIG } from './types';
/** Instancia singleton del servicio de colas */
export declare const queueService: IQueueService;
/** Re-exportar tipos para conveniencia */
export type { IQueueService, JobOptions, JobResult, JobHandler };
export { DEFAULT_RETRY_CONFIG };
/**
 * Nombres de colas estandarizados.
 * Usar estas constantes en lugar de strings hardcoded.
 */
export declare const QUEUE_NAMES: {
    /** Procesar webhooks de plataformas de delivery */
    readonly DELIVERY_WEBHOOKS: "delivery:webhooks";
    /** Sincronizar menú a plataformas externas */
    readonly MENU_SYNC: "delivery:menu-sync";
    /** Sincronizar stock a plataformas externas */
    readonly STOCK_SYNC: "delivery:stock-sync";
    /** Notificaciones push a usuarios */
    readonly NOTIFICATIONS: "notifications";
    /** Generación de reportes en background */
    readonly REPORTS: "reports";
};
export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
//# sourceMappingURL=index.d.ts.map