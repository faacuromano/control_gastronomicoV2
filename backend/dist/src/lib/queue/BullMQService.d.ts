/**
 * @fileoverview BullMQ Queue Service Implementation
 *
 * Implementación enterprise-grade del servicio de colas usando BullMQ + Redis.
 *
 * CARACTERÍSTICAS:
 * - 10 reintentos con backoff exponencial
 * - Dead Letter Queue automática
 * - Graceful shutdown
 * - Health checks
 *
 * @module lib/queue/BullMQService
 */
import type { IQueueService, JobOptions, JobResult, JobHandler } from './types';
declare class BullMQService implements IQueueService {
    private queues;
    private workers;
    private redis;
    private initialized;
    /**
     * Inicializa la conexión a Redis.
     * Se llama automáticamente en la primera operación.
     */
    private ensureInitialized;
    /**
     * Obtiene o crea una cola.
     */
    private getQueue;
    /**
     * Encola un job para procesamiento asíncrono.
     */
    enqueue<T>(queueName: string, data: T, options?: JobOptions): Promise<string>;
    /**
     * Registra un processor para una cola.
     */
    process<T>(queueName: string, handler: JobHandler<T>): void;
    /**
     * Obtiene el estado de un job.
     */
    getJob<T>(queueName: string, jobId: string): Promise<JobResult<T> | null>;
    /**
     * Health check de Redis.
     */
    isHealthy(): Promise<boolean>;
    /**
     * Cierra todas las conexiones gracefully.
     * Espera a que los jobs en proceso terminen.
     */
    close(): Promise<void>;
}
export declare const bullMQService: BullMQService;
export {};
//# sourceMappingURL=BullMQService.d.ts.map