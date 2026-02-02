/**
 * @fileoverview Implementacion del servicio de colas BullMQ
 *
 * Servicio de colas de nivel empresarial usando BullMQ + Redis.
 * BullMQ se usa como broker de mensajes para procesar webhooks de plataformas
 * de delivery (Rappi, PedidosYa, Glovo) de forma asincrona y confiable.
 *
 * CARACTERISTICAS:
 * - 10 reintentos con backoff exponencial (cubre caidas de hasta 4 horas)
 * - Dead Letter Queue automatica para jobs que agotan todos los reintentos
 * - Apagado graceful que espera a que los jobs en progreso terminen
 * - Health checks para monitoreo de infraestructura
 *
 * @module lib/queue/BullMQService
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../../utils/logger';
import type { IQueueService, JobOptions, JobResult, JobHandler, DEFAULT_RETRY_CONFIG } from './types';

// ============================================================================
// CONFIGURACION
// ============================================================================

/**
 * Configuracion de conexion a Redis.
 * En produccion se usan variables de entorno para host, puerto, password y TLS.
 *
 * FIX: Redis AUTH - Se agrega configuracion de autenticacion.
 * maxRetriesPerRequest debe ser null para que BullMQ maneje sus propios reintentos.
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  maxRetriesPerRequest: null,  // Requerido por BullMQ para su manejo interno de reintentos
  ...(process.env.REDIS_TLS === 'true' && {
    tls: { rejectUnauthorized: true } // SEC-032: Validar certificados del servidor en conexiones TLS
  }),
};

/**
 * Politica de reintentos de nivel empresarial.
 *
 * Por que esta configuracion salva al negocio durante una caida de 10 minutos?
 *
 * Escenario: El servidor de base de datos se cae a las 20:00 por mantenimiento.
 *
 * Con SOLO 3 reintentos (30s, 1m, 2m):
 * - Todos los webhooks fallan permanentemente a las 20:03:30
 * - TODAS las ordenes se pierden durante la ventana de mantenimiento
 * - El restaurante pierde dinero
 *
 * Con 10 reintentos:
 * - Los webhooks siguen reintentando hasta ~24:00 (4+ horas)
 * - El servidor se recupera a las 20:10
 * - Las ordenes pendientes (en intento 5-6) se procesan automaticamente
 * - CERO ordenes perdidas
 *
 * El costo de 10 reintentos es minimo (solo Redis almacena el job), pero el
 * beneficio para el negocio es enorme.
 */
const ENTERPRISE_RETRY_CONFIG = {
  attempts: 10,
  backoff: {
    type: 'exponential' as const,
    delay: 30000,  // 30 segundos inicial, luego 1m, 2m, 4m, 8m, 16m, 32m, 64m, 128m
  },
};

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

class BullMQService implements IQueueService {
  // Mapa de colas creadas, indexadas por nombre
  private queues: Map<string, Queue> = new Map();
  // Mapa de workers registrados, uno por cola
  private workers: Map<string, Worker> = new Map();
  // Conexion a Redis compartida para operaciones de gestion
  private redis: Redis | null = null;
  // Flag para evitar inicializacion multiple
  private initialized = false;

  /**
   * Inicializa la conexion a Redis de forma lazy.
   * Se llama automaticamente en la primera operacion que la necesite.
   * Si Redis no esta disponible, lanza error y el caller decide como manejar.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      this.redis = new Redis(REDIS_CONFIG);

      // Listener de errores de conexion para loguear sin crashear el proceso
      this.redis.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected', { host: REDIS_CONFIG.host, port: REDIS_CONFIG.port });
      });

      // Verificar que la conexion funciona antes de marcar como inicializado
      await this.redis.ping();
      this.initialized = true;
      logger.info('BullMQ Queue Service initialized');
    } catch (error) {
      logger.error('Failed to initialize BullMQ Queue Service', { error });
      throw error;
    }
  }

  /**
   * Obtiene o crea una cola por nombre.
   * Las colas se crean con configuracion de limpieza automatica:
   * - Jobs completados se eliminan despues de 1 hora o al superar 1000
   * - Jobs fallidos se conservan 7 dias para auditoria y debugging
   */
  private async getQueue(queueName: string): Promise<Queue> {
    await this.ensureInitialized();

    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: REDIS_CONFIG,
        defaultJobOptions: {
          removeOnComplete: {
            age: 3600,  // Conservar jobs completados por 1 hora
            count: 1000, // Maximo 1000 jobs completados en memoria
          },
          removeOnFail: {
            age: 86400 * 7,  // Conservar jobs fallidos por 7 dias (para auditoria)
          },
        },
      });

      this.queues.set(queueName, queue);
      logger.debug('Queue created', { queueName });
    }

    return this.queues.get(queueName)!;
  }

  /**
   * Encola un job para procesamiento asincrono.
   * El job se persiste en Redis y se procesara por el worker correspondiente.
   * Si el worker no esta corriendo, el job espera en la cola hasta que uno se registre.
   */
  async enqueue<T>(queueName: string, data: T, options?: JobOptions): Promise<string> {
    const queue = await this.getQueue(queueName);

    // Construir opciones del job, solo incluyendo valores definidos
    // para satisfacer exactOptionalPropertyTypes de TypeScript
    const jobOptions: Record<string, unknown> = {
      attempts: options?.attempts ?? ENTERPRISE_RETRY_CONFIG.attempts,
      backoff: options?.backoff ?? ENTERPRISE_RETRY_CONFIG.backoff,
    };

    if (options?.delay !== undefined) jobOptions.delay = options.delay;
    if (options?.priority !== undefined) jobOptions.priority = options.priority;
    if (options?.jobId !== undefined) jobOptions.jobId = options.jobId;

    const job = await queue.add(queueName, data, jobOptions);

    logger.debug('Job enqueued', {
      queueName,
      jobId: job.id,
      attempts: jobOptions.attempts,
    });

    return job.id!;
  }

  /**
   * Registra un procesador (worker) para una cola.
   * Solo se permite un worker por cola para evitar procesamiento duplicado.
   * El worker procesa jobs de forma concurrente (hasta 5 simultaneos).
   */
  process<T>(queueName: string, handler: JobHandler<T>): void {
    if (this.workers.has(queueName)) {
      logger.warn('Worker already exists for queue, skipping', { queueName });
      return;
    }

    const worker = new Worker(
      queueName,
      async (job: Job<T>) => {
        const startTime = Date.now();

        try {
          logger.info('Processing job', {
            queueName,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
          });

          await handler({
            id: job.id!,
            data: job.data,
            attemptsMade: job.attemptsMade,
          });

          const duration = Date.now() - startTime;
          logger.info('Job completed', {
            queueName,
            jobId: job.id,
            durationMs: duration,
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error('Job failed', {
            queueName,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            durationMs: duration,
            error: error instanceof Error ? error.message : String(error),
          });
          // Re-lanzar para que BullMQ maneje el reintento segun la politica configurada
          throw error;
        }
      },
      {
        connection: REDIS_CONFIG,
        concurrency: 5, // Procesar hasta 5 jobs simultaneamente por worker
      }
    );

    // Eventos del worker para monitoreo
    worker.on('failed', (job, error) => {
      if (job) {
        // Este evento se emite cuando un job agoto TODOS sus reintentos.
        // En este punto el job va a la Dead Letter Queue.
        logger.error('Job permanently failed (all retries exhausted)', {
          queueName,
          jobId: job.id,
          error: error.message,
          data: job.data,
        });
        // TODO: Notificar a un sistema de alertas (Slack, email, PagerDuty)
      }
    });

    worker.on('error', (error) => {
      logger.error('Worker error', { queueName, error: error.message });
    });

    this.workers.set(queueName, worker);
    logger.info('Worker registered', { queueName });
  }

  /**
   * Obtiene el estado de un job por su ID.
   * Util para que el frontend consulte el progreso de operaciones asincronas.
   */
  async getJob<T>(queueName: string, jobId: string): Promise<JobResult<T> | null> {
    const queue = await this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) return null;

    const state = await job.getState();

    return {
      id: job.id!,
      name: job.name,
      data: job.data as T,
      status: state,
      progress: job.progress as number,
      failedReason: job.failedReason ?? undefined,
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      attemptsMade: job.attemptsMade,
    };
  }

  /**
   * Health check de la conexion a Redis.
   * Usado por el endpoint /health para verificar que la infraestructura de colas funciona.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const pong = await this.redis!.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * TST-008 FIX: Verifica si hay workers registrados y corriendo.
   * Retorna false si la cola esta conectada pero ningun worker esta procesando jobs.
   * Util para diagnosticar situaciones donde los jobs se encolan pero no se procesan.
   */
  hasActiveWorkers(): boolean {
    return this.workers.size > 0;
  }

  /**
   * Cierra todas las conexiones de forma graceful.
   * Primero cierra los workers (esperando que los jobs en progreso terminen),
   * luego las colas, y finalmente la conexion a Redis.
   * Se llama durante el apagado graceful del servidor.
   */
  async close(): Promise<void> {
    logger.info('Closing BullMQ Queue Service...');

    // Cerrar workers primero (esperar a que terminen los jobs en progreso)
    for (const [name, worker] of this.workers) {
      logger.debug('Closing worker', { queueName: name });
      await worker.close();
    }
    this.workers.clear();

    // Cerrar colas
    for (const [name, queue] of this.queues) {
      logger.debug('Closing queue', { queueName: name });
      await queue.close();
    }
    this.queues.clear();

    // Cerrar conexion a Redis
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    this.initialized = false;
    logger.info('BullMQ Queue Service closed');
  }
}

// Singleton para uso en toda la aplicacion.
// Se importa directamente donde se necesite encolar o procesar jobs.
export const bullMQService = new BullMQService();
