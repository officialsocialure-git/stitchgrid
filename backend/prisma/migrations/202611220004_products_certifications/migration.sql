ALTER TABLE `CatalogItem` ADD COLUMN `imageUrl` VARCHAR(2000) NULL;

CREATE INDEX `CatalogItem_supplierProfileId_createdAt_idx` ON `CatalogItem`(`supplierProfileId`, `createdAt`);

CREATE TABLE `SupplierCertification` (
  `id` VARCHAR(191) NOT NULL,
  `supplierProfileId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `issuer` VARCHAR(180) NULL,
  `category` VARCHAR(120) NULL,
  `certificateNumber` VARCHAR(120) NULL,
  `documentUrl` VARCHAR(2000) NULL,
  `issuedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `SupplierCertification_supplierProfileId_status_createdAt_idx` (`supplierProfileId`, `status`, `createdAt`),
  INDEX `SupplierCertification_status_createdAt_idx` (`status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupplierCertification_supplierProfileId_fkey` FOREIGN KEY (`supplierProfileId`) REFERENCES `SupplierProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;