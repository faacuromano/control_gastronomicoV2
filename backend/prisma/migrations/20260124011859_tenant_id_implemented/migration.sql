/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,code]` on the table `PaymentMethodConfig` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,orderNumber]` on the table `PurchaseOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `PaymentMethodConfig_code_key` ON `paymentmethodconfig`;

-- DropIndex
DROP INDEX `PurchaseOrder_orderNumber_key` ON `purchaseorder`;

-- AlterTable
ALTER TABLE `deliverydriver` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ingredient` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `modifiergroup` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `paymentmethodconfig` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `purchaseorder` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `supplier` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `tenantplatformconfig` ADD COLUMN `lastSyncAt` DATETIME(3) NULL,
    ADD COLUMN `marginConsentAcceptedAt` DATETIME(3) NULL,
    ADD COLUMN `marginConsentAcceptedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `DeliveryDriver_tenantId_idx` ON `DeliveryDriver`(`tenantId`);

-- CreateIndex
CREATE INDEX `Ingredient_tenantId_idx` ON `Ingredient`(`tenantId`);

-- CreateIndex
CREATE INDEX `ModifierGroup_tenantId_idx` ON `ModifierGroup`(`tenantId`);

-- CreateIndex
CREATE INDEX `PaymentMethodConfig_tenantId_idx` ON `PaymentMethodConfig`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `PaymentMethodConfig_tenantId_code_key` ON `PaymentMethodConfig`(`tenantId`, `code`);

-- CreateIndex
CREATE INDEX `PurchaseOrder_tenantId_idx` ON `PurchaseOrder`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `PurchaseOrder_tenantId_orderNumber_key` ON `PurchaseOrder`(`tenantId`, `orderNumber`);

-- CreateIndex
CREATE INDEX `Supplier_tenantId_idx` ON `Supplier`(`tenantId`);

-- AddForeignKey
ALTER TABLE `ModifierGroup` ADD CONSTRAINT `ModifierGroup_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ingredient` ADD CONSTRAINT `Ingredient_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentMethodConfig` ADD CONSTRAINT `PaymentMethodConfig_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryDriver` ADD CONSTRAINT `DeliveryDriver_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
