-- AlterTable
ALTER TABLE `auditlog` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `qrcode` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `tenant` ADD COLUMN `activeSubscription` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_idx` ON `AuditLog`(`tenantId`);

-- CreateIndex
CREATE INDEX `QrCode_tenantId_idx` ON `QrCode`(`tenantId`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QrCode` ADD CONSTRAINT `QrCode_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
