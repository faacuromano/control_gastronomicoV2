-- CLEAN SLATE MIGRATION: Remove legacy OrderSequence data
-- This allows the new date-based sharding to work without conflicts

-- Step 1: Delete legacy row (id=1 with NULL sequenceKey)
DELETE FROM `OrderSequence` WHERE `sequenceKey` IS NULL;

-- Step 2: Verify table is clean (should return 0 or only valid sequenceKey rows)
-- SELECT COUNT(*) FROM `OrderSequence`;

-- Note: The application will automatically create new sequenceKey rows
-- as orders are placed. First order of the day will be #1.
