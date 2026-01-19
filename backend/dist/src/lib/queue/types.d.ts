/**
 * @fileoverview Queue Service Interface and Types
 *
 * Capa de abstracción para el sistema de colas.
 * Permite cambiar de BullMQ a RabbitMQ/SQS sin modificar el código de la aplicación.
 *
 * @module lib/queue/types
 */
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
export declare const DEFAULT_RETRY_CONFIG: {
    readonly attempts: 10;
    readonly backoff: {
        readonly type: "exponential";
        readonly delay: 30000;
    };
};
/**
 * Opciones para encolar un job.
 */
export interface JobOptions {
    /** Retrasar ejecución (ms) */
    delay?: number;
    /** Prioridad: 1 = más urgente */
    priority?: number;
    /** Override de número de reintentos */
    attempts?: number;
    /** Configuración de backoff */
    backoff?: {
        type: 'exponential' | 'fixed';
        delay: number;
    };
    /** ID único del job (para deduplicación) */
    jobId?: string;
}
/**
 * Resultado de un job.
 */
export interface JobResult<T = unknown> {
    id: string;
    name: string;
    data: T;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown' | 'prioritized' | 'waiting-children';
    progress: number;
    failedReason?: string | undefined;
    processedAt?: Date | undefined;
    finishedAt?: Date | undefined;
    attemptsMade: number;
}
/**
 * Handler para procesar jobs.
 */
export type JobHandler<T> = (job: {
    id: string;
    data: T;
    attemptsMade: number;
}) => Promise<void>;
/**
 * Interfaz abstracta del servicio de colas.
 * Implementaciones: BullMQService, InMemoryQueueService (testing)
 */
export interface IQueueService {
    /**
     * Encolar un job para procesamiento asíncrono.
     * @param queueName - Nombre de la cola
     * @param data - Datos del job
     * @param options - Opciones opcionales
     * @returns ID del job encolado
     */
    enqueue<T>(queueName: string, data: T, options?: JobOptions): Promise<string>;
    /**
     * Registrar un processor para una cola.
     * El handler se ejecutará para cada job de esa cola.
     */
    process<T>(queueName: string, handler: JobHandler<T>): void;
    /**
     * Obtener estado de un job.
     */
    getJob<T>(queueName: string, jobId: string): Promise<JobResult<T> | null>;
    /**
     * Health check de la conexión a Redis.
     */
    isHealthy(): Promise<boolean>;
    /**
     * Cerrar conexiones gracefully.
     */
    close(): Promise<void>;
}
export { DEFAULT_RETRY_CONFIG as RETRY_CONFIG };
//# sourceMappingURL=types.d.ts.map