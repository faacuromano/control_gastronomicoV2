-- P0-SEC-001/002/003: Add tenantId to DeliveryPlatform for tenant isolation
-- Step 1: Add tenantId column (nullable first for existing data)
ALTER TABLE `DeliveryPlatform` ADD COLUMN `tenantId` INTEGER NULL;

-- Step 2: Populate tenantId from TenantPlatformConfig for existing platforms
-- For platforms that have a tenant config, use that tenant's ID
UPDATE `DeliveryPlatform` dp
JOIN (
    SELECT DISTINCT `deliveryPlatformId`, `tenantId`
    FROM `TenantPlatformConfig`
    LIMIT 1
) tpc ON dp.`id` = tpc.`deliveryPlatformId`
SET dp.`tenantId` = tpc.`tenantId`
WHERE dp.`tenantId` IS NULL;

-- Step 3: For any remaining platforms without tenant config, assign to first tenant
UPDATE `DeliveryPlatform`
SET `tenantId` = (SELECT `id` FROM `Tenant` ORDER BY `id` LIMIT 1)
WHERE `tenantId` IS NULL;

-- Step 4: Make tenantId NOT NULL
ALTER TABLE `DeliveryPlatform` MODIFY COLUMN `tenantId` INTEGER NOT NULL;

-- Step 5: Drop the old unique constraint on code and add tenant-scoped unique
DROP INDEX `DeliveryPlatform_code_key` ON `DeliveryPlatform`;
CREATE UNIQUE INDEX `DeliveryPlatform_tenantId_code_key` ON `DeliveryPlatform`(`tenantId`, `code`);
CREATE INDEX `DeliveryPlatform_tenantId_idx` ON `DeliveryPlatform`(`tenantId`);

-- Step 6: Add foreign key constraint
ALTER TABLE `DeliveryPlatform` ADD CONSTRAINT `DeliveryPlatform_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- P0-DATA-001: Change Invoice.order onDelete from CASCADE to RESTRICT
ALTER TABLE `Invoice` DROP FOREIGN KEY `Invoice_orderId_fkey`;
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- P0-DATA-002: Add soft-delete to Order
ALTER TABLE `Order` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- P0-DATA-002: Change OrderItem.order onDelete from CASCADE to RESTRICT
ALTER TABLE `OrderItem` DROP FOREIGN KEY `OrderItem_orderId_fkey`;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- P0-DATA-002: Change Payment.order onDelete from CASCADE to RESTRICT
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_orderId_fkey`;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- P0-DATA-003: Add FK for Table.currentOrderId -> Order.id with SetNull
-- First clean up any stale currentOrderId values that don't reference valid orders
UPDATE `Table` t
LEFT JOIN `Order` o ON t.`currentOrderId` = o.`id`
SET t.`currentOrderId` = NULL
WHERE t.`currentOrderId` IS NOT NULL AND o.`id` IS NULL;

-- Handle duplicate currentOrderId values before adding unique constraint
-- Keep only the first table for each order, null out duplicates
UPDATE `Table` t1
JOIN (
    SELECT `currentOrderId`, MIN(`id`) as `keepId`
    FROM `Table`
    WHERE `currentOrderId` IS NOT NULL
    GROUP BY `currentOrderId`
    HAVING COUNT(*) > 1
) dups ON t1.`currentOrderId` = dups.`currentOrderId` AND t1.`id` != dups.`keepId`
SET t1.`currentOrderId` = NULL;

CREATE UNIQUE INDEX `Table_currentOrderId_key` ON `Table`(`currentOrderId`);
ALTER TABLE `Table` ADD CONSTRAINT `Table_currentOrderId_fkey` FOREIGN KEY (`currentOrderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- P0-DATA-003: Add FK for DeliveryDriver.currentOrderId -> Order.id with SetNull
-- Clean up stale values
UPDATE `DeliveryDriver` dd
LEFT JOIN `Order` o ON dd.`currentOrderId` = o.`id`
SET dd.`currentOrderId` = NULL
WHERE dd.`currentOrderId` IS NOT NULL AND o.`id` IS NULL;

-- Handle duplicate currentOrderId values
UPDATE `DeliveryDriver` d1
JOIN (
    SELECT `currentOrderId`, MIN(`id`) as `keepId`
    FROM `DeliveryDriver`
    WHERE `currentOrderId` IS NOT NULL
    GROUP BY `currentOrderId`
    HAVING COUNT(*) > 1
) dups ON d1.`currentOrderId` = dups.`currentOrderId` AND d1.`id` != dups.`keepId`
SET d1.`currentOrderId` = NULL;

CREATE UNIQUE INDEX `DeliveryDriver_currentOrderId_key` ON `DeliveryDriver`(`currentOrderId`);
ALTER TABLE `DeliveryDriver` ADD CONSTRAINT `DeliveryDriver_currentOrderId_fkey` FOREIGN KEY (`currentOrderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- P0-PERF-001/002: Add pinLookup column for O(1) PIN authentication
ALTER TABLE `User` ADD COLUMN `pinLookup` VARCHAR(64) NULL;
CREATE INDEX `User_tenantId_pinLookup_idx` ON `User`(`tenantId`, `pinLookup`);
