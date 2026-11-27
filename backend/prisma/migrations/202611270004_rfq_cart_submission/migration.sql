CREATE TABLE `CartItem` (
  `id` VARCHAR(191) NOT NULL,
  `buyerOrgId` VARCHAR(191) NOT NULL,
  `catalogItemId` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CartItem_buyerOrgId_catalogItemId_key`(`buyerOrgId`, `catalogItemId`),
  INDEX `CartItem_buyerOrgId_updatedAt_idx`(`buyerOrgId`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CartItem_buyerOrgId_fkey` FOREIGN KEY (`buyerOrgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CartItem_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RfqSubmissionGroup` (
  `id` VARCHAR(191) NOT NULL,
  `buyerOrgId` VARCHAR(191) NOT NULL,
  `deliveryLocation` TEXT NULL,
  `targetDate` DATETIME(3) NULL,
  `targetPrice` DECIMAL(12,2) NULL,
  `instructions` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RfqSubmissionGroup_buyerOrgId_createdAt_idx`(`buyerOrgId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RfqSubmissionGroup_buyerOrgId_fkey` FOREIGN KEY (`buyerOrgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Rfq`
  ADD COLUMN `submissionGroupId` VARCHAR(191) NULL,
  ADD INDEX `Rfq_submissionGroupId_idx`(`submissionGroupId`),
  ADD CONSTRAINT `Rfq_submissionGroupId_fkey` FOREIGN KEY (`submissionGroupId`) REFERENCES `RfqSubmissionGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RfqItem`
  ADD COLUMN `catalogItemId` VARCHAR(191) NULL,
  ADD COLUMN `specifications` TEXT NULL,
  ADD INDEX `RfqItem_catalogItemId_idx`(`catalogItemId`),
  ADD CONSTRAINT `RfqItem_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
