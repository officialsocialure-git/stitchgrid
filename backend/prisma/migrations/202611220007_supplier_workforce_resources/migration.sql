CREATE TABLE `SupplierWorkforceResource` (
  `id` VARCHAR(191) NOT NULL,
  `supplierProfileId` VARCHAR(191) NOT NULL,
  `resource` VARCHAR(100) NOT NULL,
  `availability` VARCHAR(20) NOT NULL,
  `headcount` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SupplierWorkforceResource_supplierProfileId_resource_key` (`supplierProfileId`, `resource`),
  INDEX `SupplierWorkforceResource_supplierProfileId_availability_idx` (`supplierProfileId`, `availability`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SupplierWorkforceResource`
  ADD CONSTRAINT `SupplierWorkforceResource_supplierProfileId_fkey`
  FOREIGN KEY (`supplierProfileId`) REFERENCES `SupplierProfile`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
