-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitem` DROP FOREIGN KEY `OrderItem_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitemmodifier` DROP FOREIGN KEY `OrderItemModifier_orderItemId_fkey`;

-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_orderId_fkey`;

-- DropIndex
DROP INDEX `Order_businessDate_idx` ON `order`;

-- DropIndex
DROP INDEX `Order_orderNumber_idx` ON `order`;

-- AlterTable
ALTER TABLE `auditlog` MODIFY `action` ENUM('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ORDER_CREATED', 'ORDER_CANCELLED', 'ORDER_REFUNDED', 'ITEM_VOIDED', 'ITEM_TRANSFERRED', 'PAYMENT_RECEIVED', 'PAYMENT_VOIDED', 'DISCOUNT_APPLIED', 'SHIFT_OPENED', 'SHIFT_CLOSED', 'CASH_ADJUSTMENT', 'STOCK_ADJUSTED', 'STOCK_WASTED', 'BULK_PRICE_UPDATE', 'USER_CREATED', 'USER_DELETED', 'ROLE_CHANGED', 'CONFIG_CHANGED', 'SYNC_COMPLETED') NOT NULL;

-- AlterTable
ALTER TABLE `ingredient` MODIFY `minStock` DECIMAL(10, 4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `tenantconfig` ADD COLUMN `defaultTaxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    INDEX `RefreshToken_tenantId_idx`(`tenantId`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaxRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaxRate_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `TaxRate_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Area_tenantId_name_key` ON `Area`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_createdAt_idx` ON `AuditLog`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_entity_entityId_idx` ON `AuditLog`(`tenantId`, `entity`, `entityId`);

-- CreateIndex
CREATE INDEX `CashShift_tenantId_userId_endTime_idx` ON `CashShift`(`tenantId`, `userId`, `endTime`);

-- CreateIndex
CREATE UNIQUE INDEX `DeliveryDriver_tenantId_phone_key` ON `DeliveryDriver`(`tenantId`, `phone`);

-- CreateIndex
CREATE UNIQUE INDEX `Ingredient_tenantId_name_key` ON `Ingredient`(`tenantId`, `name`);

-- CreateIndex
CREATE UNIQUE INDEX `ModifierGroup_tenantId_name_key` ON `ModifierGroup`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `Order_tenantId_status_idx` ON `Order`(`tenantId`, `status`);

-- CreateIndex
CREATE INDEX `Order_tenantId_businessDate_status_idx` ON `Order`(`tenantId`, `businessDate`, `status`);

-- CreateIndex
CREATE INDEX `Order_tenantId_paymentStatus_idx` ON `Order`(`tenantId`, `paymentStatus`);

-- CreateIndex
CREATE INDEX `Order_tenantId_channel_idx` ON `Order`(`tenantId`, `channel`);

-- CreateIndex
CREATE INDEX `OrderItem_orderId_productId_idx` ON `OrderItem`(`orderId`, `productId`);

-- CreateIndex
CREATE INDEX `OrderItem_orderId_status_idx` ON `OrderItem`(`orderId`, `status`);

-- CreateIndex
CREATE INDEX `Payment_shiftId_method_idx` ON `Payment`(`shiftId`, `method`);

-- CreateIndex
CREATE INDEX `Payment_tenantId_method_idx` ON `Payment`(`tenantId`, `method`);

-- CreateIndex
CREATE INDEX `Payment_tenantId_createdAt_idx` ON `Payment`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Printer_tenantId_name_key` ON `Printer`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `Product_tenantId_isActive_categoryId_idx` ON `Product`(`tenantId`, `isActive`, `categoryId`);

-- CreateIndex
CREATE UNIQUE INDEX `Product_tenantId_name_key` ON `Product`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `StockMovement_tenantId_createdAt_idx` ON `StockMovement`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE INDEX `StockMovement_ingredientId_createdAt_idx` ON `StockMovement`(`ingredientId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaxRate` ADD CONSTRAINT `TaxRate_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItemModifier` ADD CONSTRAINT `OrderItemModifier_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
