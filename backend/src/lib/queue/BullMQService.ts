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

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../../utils/logger';
import type { IQueueService, JobOptions, JobResult, JobHandler, DEFAULT_RETRY_CONFIG } from './types';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Configuración de conexión Redis.
 * En producción, usar variables de entorno.
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,  // Requerido por BullMQ
};

/**
 * Política de reintentos enterprise-grade.
 * 
 * ¿Por qué esta configuración salva el negocio durante un corte de 10 minutos?
 * 
 * Escenario: El servidor de base de datos cae a las 20:00 por mantenimiento.
 * 
 * Con SOLO 3 reintentos (30s, 1m, 2m):
 * - Todos los webhooks fallan definitivamente a las 20:03:30
 * - Pérdida de TODOS los pedidos durante la ventana de mantenimiento
 * - El restaurante pierde dinero
 * 
 * Con 10 reintentos:
 * - Los webhooks siguen reintentando hasta las ~24:00 (4+ horas)
 * - El servidor se recupera a las 20:10
 * - Los pedidos pendientes (en intento 5-6) se procesan automáticamente
 * - CERO pedidos perdidos
 * 
 * El costo de 10 reintentos es mínimo (solo Redis), pero el beneficio es enorme.
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
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redis: Redis | null = null;
  private initialized = false;

  /**
   * Inicializa la conexión a Redis.
   * Se llama automáticamente en la primera operación.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      this.redis = new Redis(REDIS_CONFIG);
      
      this.redis.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected', { host: REDIS_CONFIG.host, port: REDIS_CONFIG.port });
      });

      // Verificar conexión
      await this.redis.ping();
      this.initialized = true;
      logger.info('BullMQ Queue Service initialized');
    } catch (error) {
      logger.error('Failed to initialize BullMQ Queue Service', { error });
      throw error;
    }
  }

  /**
   * Obtiene o crea una cola.
   */
  private async getQueue(queueName: string): Promise<Queue> {
    await this.ensureInitialized();

    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: {
          host: REDIS_CONFIG.host,
          port: REDIS_CONFIG.port,
        },
        defaultJobOptions: {
          removeOnComplete: {
            age: 3600,  // Mantener jobs completados por 1 hora
            count: 1000, // Máximo 1000 jobs completados
          },
          removeOnFail: {
            age: 86400 * 7,  // Mantener jobs fallidos por 7 días (auditoría)
          },
        },
      });

      this.queues.set(queueName, queue);
      logger.debug('Queue created', { queueName });
    }

    return this.queues.get(queueName)!;
  }

  /**
   * Encola un job para procesamiento asíncrono.
   */
  async enqueue<T>(queueName: string, data: T, options?: JobOptions): Promise<string> {
    const queue = await this.getQueue(queueName);

    // Build job options, only including defined values to satisfy exactOptionalPropertyTypes
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
   * Registra un processor para una cola.
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
          throw error;  // Re-throw para que BullMQ maneje el retry
        }
      },
      {
        connection: {
          host: REDIS_CONFIG.host,
          port: REDIS_CONFIG.port,
        },
        concurrency: 5,  // Procesar hasta 5 jobs en paralelo
      }
    );

    // Eventos del worker
    worker.on('failed', (job, error) => {
      if (job) {
        logger.error('Job permanently failed (all retries exhausted)', {
          queueName,
          jobId: job.id,
          error: error.message,
          data: job.data,
        });
        // TODO: Aquí se podría notificar a un sistema de alertas
      }
    });

    worker.on('error', (error) => {
      logger.error('Worker error', { queueName, error: error.message });
    });

    this.workers.set(queueName, worker);
    logger.info('Worker registered', { queueName });
  }

  /**
   * Obtiene el estado de un job.
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
   * Health check de Redis.
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
   * Cierra todas las conexiones gracefully.
   * Espera a que los jobs en proceso terminen.
   */
  async close(): Promise<void> {
    logger.info('Closing BullMQ Queue Service...');

    // Cerrar workers primero (esperar jobs en proceso)
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

    // Cerrar Redis
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    this.initialized = false;
    logger.info('BullMQ Queue Service closed');
  }
}

// Singleton para uso en toda la aplicación
export const bullMQService = new BullMQService();
