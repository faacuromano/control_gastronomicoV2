/*
  Warnings:

  - Made the column `tenantId` on table `area` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `AreaPrinterOverride` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `auditlog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `cashshift` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `category` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `client` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `deliverydriver` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `ingredient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `modifiergroup` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `ModifierOption` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `order` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `OrderItemModifier` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `ordersequence` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `paymentmethodconfig` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `printer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `product` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `ProductChannelPrice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `ProductIngredient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `ProductModifierGroup` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `purchaseorder` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `qrcode` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `role` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `supplier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `table` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `tenantconfig` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `area` DROP FOREIGN KEY `Area_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `auditlog` DROP FOREIGN KEY `AuditLog_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `cashshift` DROP FOREIGN KEY `CashShift_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `category` DROP FOREIGN KEY `Category_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `client` DROP FOREIGN KEY `Client_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `deliverydriver` DROP FOREIGN KEY `DeliveryDriver_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `ingredient` DROP FOREIGN KEY `Ingredient_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `modifiergroup` DROP FOREIGN KEY `ModifierGroup_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `ordersequence` DROP FOREIGN KEY `OrderSequence_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `paymentmethodconfig` DROP FOREIGN KEY `PaymentMethodConfig_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `printer` DROP FOREIGN KEY `Printer_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `product` DROP FOREIGN KEY `Product_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `purchaseorder` DROP FOREIGN KEY `PurchaseOrder_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `qrcode` DROP FOREIGN KEY `QrCode_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `role` DROP FOREIGN KEY `Role_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `supplier` DROP FOREIGN KEY `Supplier_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `table` DROP FOREIGN KEY `Table_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `tenantconfig` DROP FOREIGN KEY `TenantConfig_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_tenantId_fkey`;

-- AlterTable
ALTER TABLE `area` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `areaprinteroverride` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `auditlog` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `cashshift` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `category` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `client` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `deliverydriver` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ingredient` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `invoice` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `modifiergroup` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `modifieroption` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `order` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `orderitemmodifier` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ordersequence` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `paymentmethodconfig` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `printer` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `product` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `productchannelprice` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `productingredient` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `productmodifiergroup` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `purchaseorder` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `purchaseorderitem` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `qrcode` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `role` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `stockmovement` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `supplier` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `table` MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `tenantconfig` MODIFY `id` INTEGER NOT NULL DEFAULT 1,
    MODIFY `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `tenantId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `AreaPrinterOverride_tenantId_idx` ON `AreaPrinterOverride`(`tenantId`);

-- CreateIndex
CREATE INDEX `ModifierOption_tenantId_idx` ON `ModifierOption`(`tenantId`);

-- CreateIndex
CREATE INDEX `OrderItem_tenantId_idx` ON `OrderItem`(`tenantId`);

-- CreateIndex
CREATE INDEX `OrderItemModifier_tenantId_idx` ON `OrderItemModifier`(`tenantId`);

-- CreateIndex
CREATE INDEX `Payment_tenantId_idx` ON `Payment`(`tenantId`);

-- CreateIndex
CREATE INDEX `ProductChannelPrice_tenantId_idx` ON `ProductChannelPrice`(`tenantId`);

-- CreateIndex
CREATE INDEX `ProductIngredient_tenantId_idx` ON `ProductIngredient`(`tenantId`);

-- CreateIndex
CREATE INDEX `ProductModifierGroup_tenantId_idx` ON `ProductModifierGroup`(`tenantId`);

-- CreateIndex
CREATE INDEX `PurchaseOrderItem_tenantId_idx` ON `PurchaseOrderItem`(`tenantId`);

-- CreateIndex
CREATE INDEX `StockMovement_tenantId_idx` ON `StockMovement`(`tenantId`);

-- AddForeignKey
ALTER TABLE `TenantConfig` ADD CONSTRAINT `TenantConfig_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderSequence` ADD CONSTRAINT `OrderSequence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Printer` ADD CONSTRAINT `Printer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModifierGroup` ADD CONSTRAINT `ModifierGroup_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductModifierGroup` ADD CONSTRAINT `ProductModifierGroup_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModifierOption` ADD CONSTRAINT `ModifierOption_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ingredient` ADD CONSTRAINT `Ingredient_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductIngredient` ADD CONSTRAINT `ProductIngredient_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItemModifier` ADD CONSTRAINT `OrderItemModifier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Area` ADD CONSTRAINT `Area_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AreaPrinterOverride` ADD CONSTRAINT `AreaPrinterOverride_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Table` ADD CONSTRAINT `Table_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentMethodConfig` ADD CONSTRAINT `PaymentMethodConfig_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QrCode` ADD CONSTRAINT `QrCode_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryDriver` ADD CONSTRAINT `DeliveryDriver_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductChannelPrice` ADD CONSTRAINT `ProductChannelPrice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
