/**
 * @fileoverview Interfaz y tipos del servicio de colas
 *
 * Capa de abstraccion para el sistema de colas. Define la interfaz IQueueService
 * que permite cambiar de BullMQ a RabbitMQ/SQS sin modificar el codigo de la
 * aplicacion. Todos los servicios que encolan o procesan jobs dependen de esta
 * interfaz, no de la implementacion concreta.
 *
 * @module lib/queue/types
 */

// ============================================================================
// CONFIGURACION DE COLAS
// ============================================================================

/**
 * Configuracion de la politica de reintentos.
 *
 * JUSTIFICACION: 10 intentos con backoff exponencial
 *
 * | Intento | Espera   | Tiempo Acumulado |
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
 * | FALLO   | -        | Dead Letter      |
 *
 * Por que 10 intentos?
 * - Durante una caida de 10 minutos, los primeros 5 intentos cubren hasta 7.5 min
 * - Esto permite recuperarse de la mayoria de las caidas de infraestructura
 * - Si sigue fallando despues de 4+ horas, es un problema real que requiere intervencion humana
 */
export const DEFAULT_RETRY_CONFIG = {
  attempts: 10,
  backoff: {
    type: 'exponential' as const,
    delay: 30000,  // 30 segundos inicial
  },
} as const;

/**
 * Opciones para encolar un job.
 */
export interface JobOptions {
  /** Retrasar la ejecucion (milisegundos). Util para programar acciones futuras. */
  delay?: number;
  /** Prioridad: 1 = mas urgente. Los jobs de mayor prioridad se procesan primero. */
  priority?: number;
  /** Sobreescribir el numero de reintentos por defecto */
  attempts?: number;
  /** Configuracion de backoff personalizada */
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  /** ID unico del job (para deduplicacion). Si ya existe un job con este ID, no se encola otro. */
  jobId?: string;
}

/**
 * Resultado de consultar el estado de un job.
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
 * Recibe el ID del job, los datos y el numero de intentos realizados.
 * Debe lanzar error si el procesamiento falla (BullMQ reintentara automaticamente).
 */
export type JobHandler<T> = (job: { id: string; data: T; attemptsMade: number }) => Promise<void>;

/**
 * Interfaz abstracta del servicio de colas.
 * Implementaciones: BullMQService (produccion), InMemoryQueueService (testing).
 * Usar esta interfaz en lugar de la implementacion concreta para facilitar
 * el testing y la migracion a otros proveedores.
 */
export interface IQueueService {
  /**
   * Encola un job para procesamiento asincrono.
   * @param queueName - Nombre de la cola (usar constantes de QUEUE_NAMES)
   * @param data - Datos del job que recibira el handler
   * @param options - Opciones opcionales (delay, prioridad, reintentos)
   * @returns ID del job encolado
   */
  enqueue<T>(queueName: string, data: T, options?: JobOptions): Promise<string>;

  /**
   * Registra un procesador para una cola.
   * El handler se ejecutara por cada job en esa cola.
   * Solo se debe registrar un handler por cola.
   */
  process<T>(queueName: string, handler: JobHandler<T>): void;

  /**
   * Obtiene el estado de un job por su ID.
   * Retorna null si el job no existe o fue eliminado por la politica de limpieza.
   */
  getJob<T>(queueName: string, jobId: string): Promise<JobResult<T> | null>;

  /**
   * Health check de la conexion a Redis.
   * Retorna true si Redis responde al ping.
   */
  isHealthy(): Promise<boolean>;

  /**
   * TST-008: Verifica si hay workers registrados y procesando jobs.
   * Util para diagnosticar cuando los jobs se encolan pero no se procesan.
   */
  hasActiveWorkers(): boolean;

  /**
   * Cierra conexiones de forma graceful.
   * Espera a que los jobs en progreso terminen antes de cerrar.
   */
  close(): Promise<void>;
}

// ============================================================================
// RE-EXPORTACIONES
// ============================================================================

export { DEFAULT_RETRY_CONFIG as RETRY_CONFIG };
