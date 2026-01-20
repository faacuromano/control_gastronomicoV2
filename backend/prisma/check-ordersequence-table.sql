-- Diagnostic script to check OrderSequence table structure
-- Run this to understand the current database schema

-- Check table structure
DESCRIBE `OrderSequence`;

-- Check current data
SELECT * FROM `OrderSequence`;

-- Check for AUTO_INCREMENT setting
SHOW CREATE TABLE `OrderSequence`;
