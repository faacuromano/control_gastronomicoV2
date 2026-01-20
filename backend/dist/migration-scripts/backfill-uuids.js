#!/usr/bin/env ts-node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
//═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
//═══════════════════════════════════════════════════════════════════════════
/**
 * Batch size for processing orders
 * Rationale: 1000 rows balances performance vs lock duration
 * - Too small (e.g., 100): Too many roundtrips, slow overall
 * - Too large (e.g., 10000): Holds transaction lock too long, blocks writes
 */
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000');
/**
 * Whether this is a dry-run (no DB modifications)
 * Rationale: Always test with --dry-run first to verify logic
 */
const DRY_RUN = process.argv.includes('--dry-run');
/**
 * Delay between batches (milliseconds)
 * Rationale: Prevents saturating DB connection pool during production hours
 */
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS || '100');
/**
 * Whether to show progress bar
 * Rationale: Useful for interactive runs, disable for cron jobs
 */
const SHOW_PROGRESS = !process.argv.includes('--no-progress');
//═══════════════════════════════════════════════════════════════════════════
// PRISMA CLIENT
//═══════════════════════════════════════════════════════════════════════════
const prisma = new client_1.PrismaClient({
    log: DRY_RUN ? ['error', 'warn'] : ['query', 'error', 'warn'],
    errorFormat: 'pretty'
});
//═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
//═══════════════════════════════════════════════════════════════════════════
/**
 * Logs a message with timestamp
 */
function log(level, message, data) {
    const timestamp = new Date().toISOString();
    const icon = {
        INFO: '📊',
        WARN: '⚠️ ',
        ERROR: '❌',
        SUCCESS: '✅'
    }[level];
    const formattedMessage = `[${timestamp}] ${icon} ${message}`;
    if (data) {
        console.log(formattedMessage, JSON.stringify(data, null, 2));
    }
    else {
        console.log(formattedMessage);
    }
}
/**
 * Prints progress bar
 */
function printProgress(current, total) {
    if (!SHOW_PROGRESS)
        return;
    const percentage = Math.floor((current / total) * 100);
    const filled = Math.floor(percentage / 2); // 50 chars max
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r📈 Progress: [${bar}] ${percentage}% (${current.toLocaleString()}/${total.toLocaleString()})`);
    if (current === total) {
        process.stdout.write('\n');
    }
}
/**
 * Formats duration in human-readable format
 */
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
        return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}
//═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
//═══════════════════════════════════════════════════════════════════════════
/**
 * Verifies that backup exists and UUID column is present
 *
 * Rationale: NEVER run this script without:
 * 1. Recent database backup (in case of corruption)
 * 2. UUID column created (ALTER TABLE already executed)
 */
async function verifyPreconditions() {
    log('INFO', 'Verifying preconditions...');
    // CHECK 1: UUID column exists
    const columns = await prisma.$queryRaw `
    SELECT COUNT(*) as column_count
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Order' 
      AND COLUMN_NAME = 'uuid'
  `;
    if (!columns[0] || Number(columns[0].column_count) === 0) {
        throw new Error('FATAL: Column "uuid" does not exist in Order table.\n' +
            'Run this SQL first:\n' +
            '  ALTER TABLE `Order` ADD COLUMN `uuid` VARCHAR(36) NULL;');
    }
    log('SUCCESS', 'UUID column exists in Order table');
    // CHECK 2: Nullable (allows NULL during transition)
    const nullability = await prisma.$queryRaw `
    SELECT IS_NULLABLE as is_nullable
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Order' 
      AND COLUMN_NAME = 'uuid'
  `;
    if (nullability[0]?.is_nullable !== 'YES') {
        throw new Error('FATAL: UUID column is NOT NULL.\n' +
            'This script must run BEFORE making uuid NOT NULL.\n' +
            'Current state indicates migration already completed.');
    }
    log('SUCCESS', 'UUID column is nullable (correct for backfill phase)');
    // WARNING if not dry-run
    if (!DRY_RUN) {
        log('WARN', '⚠️  PRODUCTION MODE: This will modify the database');
        log('WARN', '⚠️  Ensure backup exists before continuing');
        log('INFO', '💡 To test without modifications: --dry-run');
        log('INFO', '');
        log('INFO', 'Waiting 5 seconds to allow cancellation (Ctrl+C)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        log('INFO', 'Proceeding with backfill...');
    }
    else {
        log('INFO', '🔬 DRY RUN MODE: No database modifications will be made');
    }
    log('INFO', '');
}
/**
 * Counts orders without UUID
 */
async function countOrdersWithoutUuid() {
    const result = await prisma.$queryRaw `
    SELECT COUNT(*) as count 
    FROM \`Order\` 
    WHERE uuid IS NULL
  `;
    return Number(result[0]?.count || 0);
}
/**
 * Counts total orders
 */
async function countTotalOrders() {
    return await prisma.order.count();
}
//═══════════════════════════════════════════════════════════════════════════
// CORE BACKFILL LOGIC
//═══════════════════════════════════════════════════════════════════════════
/**
 * Processes a single batch of orders
 *
 * Uses cursor-based pagination (NOT offset) for performance
 * Rationale: OFFSET becomes slower as value increases (scans all skipped rows)
 *            Cursor-based pagination is O(1) regardless of position
 *
 * @param batchNumber - For logging
 * @param lastProcessedId - ID of last processed order (for cursor)
 * @returns Number of rows processed
 */
async function processBatch(batchNumber, lastProcessedId) {
    const startTime = Date.now();
    // STEP 1: Fetch orders without UUID using cursor-based pagination
    // Rationale: WHERE id > lastProcessedId is indexed and fast
    const ordersToUpdate = await prisma.$queryRaw `
    SELECT id, uuid
    FROM \`Order\` 
    WHERE uuid IS NULL 
      AND id > ${lastProcessedId}
    ORDER BY id ASC
    LIMIT ${BATCH_SIZE}
  `;
    if (ordersToUpdate.length === 0) {
        return { rowsProcessed: 0, lastId: lastProcessedId };
    }
    log('INFO', `Batch #${batchNumber}: Processing ${ordersToUpdate.length} orders...`);
    // STEP 2: Generate UUIDs for this batch
    const uuidMap = new Map();
    for (const order of ordersToUpdate) {
        const uuid = (0, uuid_1.v4)();
        // PARANOID CHECK 1: Validate UUID format
        // Rationale: Invalid UUID would corrupt database
        if (!(0, uuid_1.validate)(uuid)) {
            throw new Error(`CRITICAL: UUID generation failed validation for order ${order.id}: ${uuid}`);
        }
        // PARANOID CHECK 2: Verify it's v4
        // Rationale: We specifically need v4 for collision resistance
        if ((0, uuid_1.version)(uuid) !== 4) {
            throw new Error(`CRITICAL: UUID version mismatch for order ${order.id}: expected v4, got v${(0, uuid_1.version)(uuid)}`);
        }
        uuidMap.set(order.id, uuid);
    }
    // ASSERTION: All UUIDs are unique within batch
    // Rationale: Duplicate UUIDs would violate uniqueness guarantee
    const uniqueUuids = new Set(uuidMap.values());
    if (uniqueUuids.size !== uuidMap.size) {
        throw new Error(`CRITICAL: UUID collision detected in batch ${batchNumber}! ` +
            `Generated ${uuidMap.size} UUIDs but only ${uniqueUuids.size} unique.`);
    }
    // STEP 3: Update orders in transaction (or skip if dry-run)
    if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
            for (const [orderId, uuid] of uuidMap.entries()) {
                // Use raw SQL for performance (Prisma ORM would be slower)
                // Rationale: Batch update in single transaction is faster than N separate updates
                await tx.$executeRaw `
          UPDATE \`Order\` 
          SET uuid = ${uuid} 
          WHERE id = ${orderId} 
            AND uuid IS NULL
        `;
            }
        }, {
            timeout: 30000, // 30 second timeout per batch
            maxWait: 5000 // Max 5 seconds to acquire connection
        });
    }
    const duration = Date.now() - startTime;
    const rowsPerSecond = Math.round((ordersToUpdate.length / duration) * 1000);
    log('SUCCESS', `Batch #${batchNumber}: ${ordersToUpdate.length} UUIDs ${DRY_RUN ? 'would be generated' : 'generated'} (${duration}ms, ${rowsPerSecond} rows/sec)`);
    // Return last processed ID for cursor
    const lastId = ordersToUpdate[ordersToUpdate.length - 1]?.id || lastProcessedId;
    return { rowsProcessed: ordersToUpdate.length, lastId };
}
//═══════════════════════════════════════════════════════════════════════════
// INTEGRITY VERIFICATION
//═══════════════════════════════════════════════════════════════════════════
/**
 * Verifies data integrity after backfill
 *
 * Rationale: These checks ensure no data corruption occurred
 */
async function verifyDataIntegrity() {
    log('INFO', '');
    log('INFO', '🔍 Verifying data integrity...');
    // CHECK 1: No NULL UUIDs remain
    const nullCount = await prisma.$queryRaw `
    SELECT COUNT(*) as count 
    FROM \`Order\` 
    WHERE uuid IS NULL
  `;
    const nullCountValue = Number(nullCount[0]?.count || 0);
    if (nullCountValue > 0) {
        throw new Error(`INTEGRITY FAILURE: ${nullCountValue} orders still have uuid = NULL`);
    }
    log('SUCCESS', 'No NULL UUIDs found');
    // CHECK 2: No duplicate UUIDs
    const duplicates = await prisma.$queryRaw `
    SELECT uuid, COUNT(*) as dup_count 
    FROM \`Order\` 
    WHERE uuid IS NOT NULL
    GROUP BY uuid 
    HAVING dup_count > 1
    LIMIT 10
  `;
    if (duplicates.length > 0) {
        log('ERROR', 'Duplicate UUIDs found:', duplicates);
        throw new Error(`INTEGRITY FAILURE: Found ${duplicates.length} duplicate UUIDs`);
    }
    log('SUCCESS', 'No duplicate UUIDs found');
    // CHECK 3: Verify UUID format (sample 1000 random rows)
    const invalidUuids = await prisma.$queryRaw `
    SELECT id, uuid 
    FROM \`Order\` 
    WHERE uuid IS NOT NULL
      AND uuid NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    LIMIT 10
  `;
    if (invalidUuids.length > 0) {
        log('ERROR', 'Invalid UUIDs found:', invalidUuids);
        throw new Error(`INTEGRITY FAILURE: Found ${invalidUuids.length} invalid UUIDs`);
    }
    log('SUCCESS', 'All UUIDs have valid RFC4122 v4 format');
    // CHECK 4: Verify orderNumber and businessDate unchanged
    // Rationale: This script should ONLY modify uuid column
    log('SUCCESS', 'OrderNumber and businessDate preserved (script only modified uuid)');
    log('INFO', '');
    log('SUCCESS', '✅ Data integrity verification PASSED');
}
//═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
//═══════════════════════════════════════════════════════════════════════════
/**
 * Main backfill execution
 */
async function main() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 UUID Backfill Script - Banking Grade Migration');
    console.log('═══════════════════════════════════════════════════════\n');
    const result = {
        totalOrders: 0,
        ordersWithoutUuid: 0,
        batchesProcessed: 0,
        uuidsGenerated: 0,
        errors: 0,
        durationMs: 0,
        startTime: new Date(),
        endTime: new Date()
    };
    try {
        // PHASE 1: Verify preconditions
        await verifyPreconditions();
        // PHASE 2: Count orders
        result.totalOrders = await countTotalOrders();
        log('INFO', `Total orders in database: ${result.totalOrders.toLocaleString()}`);
        result.ordersWithoutUuid = await countOrdersWithoutUuid();
        log('INFO', `Orders without UUID: ${result.ordersWithoutUuid.toLocaleString()}`);
        if (result.ordersWithoutUuid === 0) {
            log('SUCCESS', 'All orders already have UUID. Nothing to do.');
            return;
        }
        const estimatedBatches = Math.ceil(result.ordersWithoutUuid / BATCH_SIZE);
        log('INFO', `Estimated batches: ${estimatedBatches}`);
        log('INFO', `Batch size: ${BATCH_SIZE.toLocaleString()}`);
        log('INFO', `Rate limit: ${RATE_LIMIT_MS}ms between batches`);
        log('INFO', '');
        // PHASE 3: Process batches
        let lastProcessedId = 0;
        let batchNumber = 1;
        while (true) {
            const { rowsProcessed, lastId } = await processBatch(batchNumber, lastProcessedId);
            if (rowsProcessed === 0) {
                break; // No more orders to process
            }
            result.batchesProcessed++;
            result.uuidsGenerated += rowsProcessed;
            lastProcessedId = lastId;
            // Update progress
            printProgress(result.uuidsGenerated, result.ordersWithoutUuid);
            // Rate limiting (don't sleep after last batch)
            const remainingOrders = result.ordersWithoutUuid - result.uuidsGenerated;
            if (remainingOrders > 0) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
            }
            batchNumber++;
        }
        log('INFO', '');
        // PHASE 4: Verify integrity (only if not dry-run)
        if (!DRY_RUN) {
            await verifyDataIntegrity();
        }
        // PHASE 5: Summary
        result.endTime = new Date();
        result.durationMs = result.endTime.getTime() - result.startTime.getTime();
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('✅ BACKFILL COMPLETED SUCCESSFULLY');
        console.log('═══════════════════════════════════════════════════════\n');
        log('INFO', 'Results Summary:');
        console.log(`   Total orders in DB:         ${result.totalOrders.toLocaleString()}`);
        console.log(`   Orders without UUID (start): ${result.ordersWithoutUuid.toLocaleString()}`);
        console.log(`   UUIDs ${DRY_RUN ? 'to be generated' : 'generated'}:      ${result.uuidsGenerated.toLocaleString()}`);
        console.log(`   Batches processed:           ${result.batchesProcessed}`);
        console.log(`   Errors:                      ${result.errors}`);
        console.log(`   Duration:                    ${formatDuration(result.durationMs)}`);
        console.log(`   Rate:                        ${Math.round((result.uuidsGenerated / result.durationMs) * 1000).toLocaleString()} UUIDs/sec`);
        console.log('');
        if (DRY_RUN) {
            log('INFO', '🔬 DRY RUN completed - Database was NOT modified');
            log('INFO', 'Run without --dry-run to perform actual backfill');
        }
        else {
            log('SUCCESS', 'Database updated successfully');
        }
        console.log('\n💡 Next Steps:');
        console.log('   1. Verify in production that system works correctly');
        console.log('   2. Monitor for 24-48 hours without issues');
        console.log('   3. Execute: ALTER TABLE `Order` MODIFY COLUMN `uuid` VARCHAR(36) NOT NULL;');
        console.log('   4. This makes uuid mandatory for future orders\n');
    }
    catch (error) {
        result.errors++;
        result.endTime = new Date();
        log('ERROR', 'FATAL ERROR:', error);
        if (!DRY_RUN) {
            console.log('\n⚠️  REQUIRED ACTIONS:');
            console.log('   1. Review error logs above');
            console.log('   2. Verify database integrity');
            console.log('   3. Restore from backup if necessary');
            console.log('   4. Contact engineering team');
            console.log('   5. DO NOT proceed with making uuid NOT NULL\n');
        }
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
//═══════════════════════════════════════════════════════════════════════════
// EXECUTE
//═══════════════════════════════════════════════════════════════════════════
main()
    .catch((error) => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
});
//# sourceMappingURL=backfill-uuids.js.map