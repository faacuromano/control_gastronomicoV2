/**
 * @fileoverview Queue Service Factory & Exports
 *
 * Entry point for the queue system.
 * Exports the appropriate implementation based on environment.
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

// CFG-010: Supported queue providers
const SUPPORTED_PROVIDERS = ['bullmq'] as const;

/**
 * Factory function to get the appropriate queue service.
 * In testing, could return InMemoryQueueService.
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
// EXPORTS
// ============================================================================

/** Singleton queue service instance */
export const queueService = createQueueService();

/** Re-export types for convenience */
export type { IQueueService, JobOptions, JobResult, JobHandler };
export { DEFAULT_RETRY_CONFIG };

// ============================================================================
// PREDEFINED QUEUE NAMES
// ============================================================================

/**
 * Standardized queue names.
 * Use these constants instead of hardcoded strings.
 */
export const QUEUE_NAMES = {
  /** Process webhooks from delivery platforms */
  DELIVERY_WEBHOOKS: 'delivery:webhooks',
  /** Sync menu to external platforms */
  MENU_SYNC: 'delivery:menu-sync',
  /** Sync stock to external platforms */
  STOCK_SYNC: 'delivery:stock-sync',
  /** Push notifications to users */
  NOTIFICATIONS: 'notifications',
  /** Background report generation */
  REPORTS: 'reports',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
