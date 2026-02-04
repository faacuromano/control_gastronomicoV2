-- AlterTable
ALTER TABLE `area` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `category` ADD COLUMN `kdsStationId` INTEGER NULL;

-- AlterTable
ALTER TABLE `client` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `kdsStationId` INTEGER NULL;

-- AlterTable
ALTER TABLE `table` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `KdsStation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KdsStation_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `KdsStation_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Category_kdsStationId_idx` ON `Category`(`kdsStationId`);

-- CreateIndex
CREATE INDEX `Order_tenantId_deletedAt_idx` ON `Order`(`tenantId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `Order_tenantId_closedAt_idx` ON `Order`(`tenantId`, `closedAt`);

-- CreateIndex
CREATE INDEX `Product_kdsStationId_idx` ON `Product`(`kdsStationId`);

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_kdsStationId_fkey` FOREIGN KEY (`kdsStationId`) REFERENCES `KdsStation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KdsStation` ADD CONSTRAINT `KdsStation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_kdsStationId_fkey` FOREIGN KEY (`kdsStationId`) REFERENCES `KdsStation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
