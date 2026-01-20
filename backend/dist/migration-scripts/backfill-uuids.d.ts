#!/usr/bin/env ts-node
/**
 * @fileoverview UUID Backfill Script - Populate UUIDs for Historical Orders
 *
 * CRITICALITY: FINANCIAL DATA - Must be idempotent and safe
 * PURPOSE: Generate UUIDs for legacy orders (uuid = NULL)
 *
 * SAFETY FEATURES:
 * - Batching: Processes 1000 rows at a time (prevents table lock)
 * - Idempotency: Can be re-executed without side effects
 * - Progress Tracking: Logs progress every batch
 * - Error Handling: Automatic rollback on failure
 * - Performance: Rate limiting to avoid DB saturation
 * - Dry-run: Test mode that doesn't modify DB
 *
 * GUARANTEES:
 * - NEVER modifies orders that already have uuid
 * - NEVER modifies orderNumber, businessDate, or other fields
 * - Validates UUID format before committing
 * - Verifies backup exists before starting
 *
 * USAGE:
 * ```bash
 * # Dry-run (NO database modification)
 * npx ts-node migration-scripts/backfill-uuids.ts --dry-run
 *
 * # Production run
 * npx ts-node migration-scripts/backfill-uuids.ts
 *
 * # Custom batch size
 * npx ts-node migration-scripts/backfill-uuids.ts --batch-size=500
 *
 * # Custom rate limit (ms between batches)
 * npx ts-node migration-scripts/backfill-uuids.ts --rate-limit=200
 * ```
 *
 * EXIT CODES:
 * 0 = Success
 * 1 = Fatal error (requires manual intervention)
 * 2 = Validation failure (integrity check failed)
 */
export {};
//# sourceMappingURL=backfill-uuids.d.ts.map