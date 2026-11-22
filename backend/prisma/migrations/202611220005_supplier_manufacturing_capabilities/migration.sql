ALTER TABLE `SupplierProfile`
  ADD COLUMN `minimumOrderQuantity` INTEGER NULL,
  ADD COLUMN `sampleDevelopment` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `SupplierCapability` (
  `id` VARCHAR(191) NOT NULL,
  `supplierProfileId` VARCHAR(191) NOT NULL,
  `capabilityGroup` VARCHAR(30) NOT NULL,
  `value` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupplierCapability_supplierProfileId_capabilityGroup_value_key` (`supplierProfileId`, `capabilityGroup`, `value`),
  INDEX `SupplierCapability_supplierProfileId_capabilityGroup_idx` (`supplierProfileId`, `capabilityGroup`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SupplierCapability`
  ADD CONSTRAINT `SupplierCapability_supplierProfileId_fkey`
  FOREIGN KEY (`supplierProfileId`) REFERENCES `SupplierProfile`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
