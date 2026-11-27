ALTER TABLE `CatalogItem`
  ADD COLUMN `gender` VARCHAR(30) NULL,
  ADD COLUMN `material` VARCHAR(120) NULL,
  ADD COLUMN `gsm` INTEGER NULL,
  ADD COLUMN `sizes` TEXT NULL,
  ADD COLUMN `colors` TEXT NULL,
  ADD COLUMN `manufacturingType` VARCHAR(80) NULL,
  ADD COLUMN `customization` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE TABLE `CatalogItemPriceTier` (
  `id` VARCHAR(191) NOT NULL,
  `catalogItemId` VARCHAR(191) NOT NULL,
  `minQuantity` INTEGER NOT NULL,
  `maxQuantity` INTEGER NULL,
  `unitPrice` DECIMAL(12,2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CatalogItemPriceTier_catalogItemId_minQuantity_idx` (`catalogItemId`, `minQuantity`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CatalogItemPriceTier_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;