-- Migration: Add date-based sharding to OrderSequence
-- Preserves existing data while adding new fields

-- Step 1: Add new columns
ALTER TABLE `OrderSequence` 
  ADD COLUMN `sequenceKey` VARCHAR(8) NULL AFTER `id`,
  ADD COLUMN `currentValue` INT NOT NULL DEFAULT 0 AFTER `sequenceKey`,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `lastNumber`,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER `createdAt`;

-- Step 2: Seed today's sequence with current lastNumber value
-- Get today's date in YYYYMMDD format and insert as the current sequence
SET @today = DATE_FORMAT(NOW(), '%Y%m%d');
SET @current_last_number = (SELECT `lastNumber` FROM `OrderSequence` WHERE `id` = 1);

UPDATE `OrderSequence` 
SET 
  `sequenceKey` = @today,
  `currentValue` = @current_last_number
WHERE `id` = 1;

-- Step 3: Add unique constraint and index
ALTER TABLE `OrderSequence`
  ADD UNIQUE KEY `OrderSequence_sequenceKey_key` (`sequenceKey`),
  ADD INDEX `OrderSequence_sequenceKey_idx` (`sequenceKey`);

-- Step 4 (Optional): If id needs to change to autoincrement, handle after data migration
-- For now, keep existing id=1 row intact
-- ALTER TABLE `OrderSequence` MODIFY COLUMN `id` INT NOT NULL AUTO_INCREMENT;
