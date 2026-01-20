-- ============================================================================
-- MIGRATION: Hourly Sharding for OrderSequence
-- ============================================================================
-- PURPOSE: Reduce lock contention by 24x by sharding OrderSequence per hour
-- 
-- BEFORE: sequenceKey = "20260119" (8 chars, YYYYMMDD)
--         → 1 row per day → All orders compete for same lock
--
-- AFTER:  sequenceKey = "2026011914" (10 chars, YYYYMMDDHH)
--         → 24 rows per day → Orders distributed across hourly buckets
--
-- EXPECTED IMPACT:
-- - Lock contention: 100 concurrent txns → ~4 concurrent txns per shard
-- - Latency: 1200ms → ~50ms (24x improvement)
-- - Zero downtime (ALTER is safe, expands field size)
--
-- SAFETY:
-- - Backwards compatible: Existing 8-char keys still work
-- - No data loss: Expanding VARCHAR is safe operation
-- - Rollback: Can revert to daily keys by app code change only
-- ============================================================================

-- STEP 1: Expand VARCHAR from 8 to 12 characters
-- Rationale: YYYYMMDDHH = 10 chars, using 12 for future flexibility
ALTER TABLE `OrderSequence`
  MODIFY COLUMN `sequenceKey` VARCHAR(12) NOT NULL;

-- STEP 2: Verify change
SELECT 
  TABLE_NAME, 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'OrderSequence'
  AND COLUMN_NAME = 'sequenceKey';

-- Expected output:
-- +---------------+-------------+-------------+--------------------------+
-- | TABLE_NAME    | COLUMN_NAME | COLUMN_TYPE | CHARACTER_MAXIMUM_LENGTH |
-- +---------------+-------------+-------------+--------------------------+
-- | OrderSequence | sequenceKey | varchar(12) |                       12 |
-- +---------------+-------------+-------------+--------------------------+

-- STEP 3: Show current sequences (for audit)
SELECT 
  id,
  sequenceKey,
  currentValue,
  LENGTH(sequenceKey) as key_length,
  createdAt,
  updatedAt
FROM OrderSequence
ORDER BY sequenceKey DESC
LIMIT 10;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================
-- After deploying code with getBusinessDateKeyHourly():
--
-- 1. Monitor new sequence keys are 10 chars (YYYYMMDDHH):
--    SELECT DISTINCT LENGTH(sequenceKey) FROM OrderSequence;
--    Expected: 8, 10 (both old and new format)
--
-- 2. Verify hourly distribution:
--    SELECT 
--      LEFT(sequenceKey, 8) as business_date,
--      COUNT(*) as hourly_shards,
--      MIN(currentValue) as min_orders,
--      MAX(currentValue) as max_orders
--    FROM OrderSequence
--    WHERE LENGTH(sequenceKey) = 10
--    GROUP BY LEFT(sequenceKey, 8)
--    ORDER BY business_date DESC;
--
--    Expected: ~24 shards per business_date (one per hour)
--
-- 3. Monitor performance metrics:
--    - ORDER_ID_GENERATION_SLOW warnings should drop to <1%
--    - p95 latency should be <100ms
-- ============================================================================
