/**
 * OrderSequence Cleanup Job
 *
 * Removes old OrderSequence rows older than 90 days to prevent
 * unbounded table growth in multi-tenant environments.
 *
 * Can be called from a BullMQ repeatable job or a cron scheduler.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const RETENTION_DAYS = 90;

export async function cleanupOldSequences(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const deleted = await prisma.orderSequence.deleteMany({
        where: {
            updatedAt: { lt: cutoff },
        },
    });

    logger.info('OrderSequence cleanup completed', {
        deletedCount: deleted.count,
        cutoffDate: cutoff.toISOString(),
        retentionDays: RETENTION_DAYS,
    });

    return deleted.count;
}
