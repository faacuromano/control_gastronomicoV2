/**
 * @fileoverview Queue Service Interface and Types
 *
 * Abstraction layer for the queue system.
 * Allows switching from BullMQ to RabbitMQ/SQS without modifying application code.
 *
 * @module lib/queue/types
 */

// ============================================================================
// CONFIGURACIÓN DE COLA
// ============================================================================

/**
 * Retry policy configuration.
 *
 * RATIONALE: 10 attempts with exponential backoff
 *
 * | Attempt | Delay    | Cumulative Time  |
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
 * Why 10 attempts?
 * - During a 10-minute outage, the first 5 attempts cover up to 7.5 min
 * - This allows recovery from most infrastructure outages
 * - If still failing after 4+ hours, it's a real problem requiring intervention
 */
export const DEFAULT_RETRY_CONFIG = {
  attempts: 10,
  backoff: {
    type: 'exponential' as const,
    delay: 30000,  // 30 seconds initial
  },
} as const;

/**
 * Options for enqueuing a job.
 */
export interface JobOptions {
  /** Delay execution (ms) */
  delay?: number;
  /** Priority: 1 = most urgent */
  priority?: number;
  /** Override retry count */
  attempts?: number;
  /** Backoff configuration */
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  /** Unique job ID (for deduplication) */
  jobId?: string;
}

/**
 * Job result.
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
 * Handler for processing jobs.
 */
export type JobHandler<T> = (job: { id: string; data: T; attemptsMade: number }) => Promise<void>;

/**
 * Abstract queue service interface.
 * Implementations: BullMQService, InMemoryQueueService (testing)
 */
export interface IQueueService {
  /**
   * Enqueue a job for async processing.
   * @param queueName - Queue name
   * @param data - Job data
   * @param options - Optional options
   * @returns Enqueued job ID
   */
  enqueue<T>(queueName: string, data: T, options?: JobOptions): Promise<string>;

  /**
   * Register a processor for a queue.
   * The handler will execute for each job in that queue.
   */
  process<T>(queueName: string, handler: JobHandler<T>): void;

  /**
   * Get job status.
   */
  getJob<T>(queueName: string, jobId: string): Promise<JobResult<T> | null>;

  /**
   * Redis connection health check.
   */
  isHealthy(): Promise<boolean>;

  /**
   * TST-008: Check if any workers are registered and processing jobs.
   */
  hasActiveWorkers(): boolean;

  /**
   * Close connections gracefully.
   */
  close(): Promise<void>;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { DEFAULT_RETRY_CONFIG as RETRY_CONFIG };
