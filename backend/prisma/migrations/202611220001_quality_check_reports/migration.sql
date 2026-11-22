CREATE TABLE `QualityCheckReport` (
  `id` VARCHAR(191) NOT NULL,
  `purchaseOrderId` VARCHAR(191) NOT NULL,
  `supplierUserId` VARCHAR(191) NOT NULL,
  `status` ENUM('SUBMITTED','APPROVED','RECHECK_REQUESTED') NOT NULL DEFAULT 'SUBMITTED',
  `totalQuantity` INTEGER NOT NULL,
  `inspectedQuantity` INTEGER NOT NULL,
  `passedQuantity` INTEGER NOT NULL,
  `defectiveQuantity` INTEGER NOT NULL,
  `checklist` JSON NOT NULL,
  `photos` JSON NOT NULL,
  `defectivePhotos` JSON NULL,
  `remarks` TEXT NULL,
  `buyerFeedback` TEXT NULL,
  `reviewedByUserId` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `QualityCheckReport_purchaseOrderId_status_submittedAt_idx` (`purchaseOrderId`, `status`, `submittedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `QualityCheckReport_purchaseOrderId_fkey`
    FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
