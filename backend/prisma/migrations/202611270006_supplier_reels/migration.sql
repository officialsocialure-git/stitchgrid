CREATE TABLE `SupplierReel` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `videoUrl` VARCHAR(2000) NOT NULL,
  `durationSeconds` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN') NOT NULL DEFAULT 'PENDING',
  `isActive` BOOLEAN NOT NULL DEFAULT false,
  `moderationNote` VARCHAR(500) NULL,
  `impressionCount` INTEGER NOT NULL DEFAULT 0,
  `viewCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `SupplierReel_status_isActive_createdAt_idx`(`status`, `isActive`, `createdAt`),
  INDEX `SupplierReel_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `SupplierReel_impressionCount_status_isActive_idx`(`impressionCount`, `status`, `isActive`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupplierReel_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupplierReelProduct` (
  `id` VARCHAR(191) NOT NULL,
  `reelId` VARCHAR(191) NOT NULL,
  `catalogItemId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupplierReelProduct_reelId_catalogItemId_key`(`reelId`, `catalogItemId`),
  INDEX `SupplierReelProduct_catalogItemId_idx`(`catalogItemId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupplierReelProduct_reelId_fkey` FOREIGN KEY (`reelId`) REFERENCES `SupplierReel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SupplierReelProduct_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupplierReelEvent` (
  `id` VARCHAR(191) NOT NULL,
  `eventKey` VARCHAR(191) NOT NULL,
  `reelId` VARCHAR(191) NOT NULL,
  `viewerKey` VARCHAR(120) NOT NULL,
  `eventType` VARCHAR(20) NOT NULL,
  `watchSeconds` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupplierReelEvent_eventKey_key`(`eventKey`),
  INDEX `SupplierReelEvent_viewerKey_eventType_createdAt_idx`(`viewerKey`, `eventType`, `createdAt`),
  INDEX `SupplierReelEvent_reelId_eventType_createdAt_idx`(`reelId`, `eventType`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupplierReelEvent_reelId_fkey` FOREIGN KEY (`reelId`) REFERENCES `SupplierReel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
