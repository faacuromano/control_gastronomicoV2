-- Fix OrderSequence table structure
-- This ensures the id column has AUTO_INCREMENT set correctly

-- Drop and recreate the table with correct structure
DROP TABLE IF EXISTS `OrderSequence`;

CREATE TABLE `OrderSequence` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sequenceKey` VARCHAR(8) NOT NULL,
  `currentValue` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `OrderSequence_sequenceKey_key` (`sequenceKey`),
  KEY `OrderSequence_sequenceKey_idx` (`sequenceKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
