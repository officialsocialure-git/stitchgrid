CREATE TABLE `TrendyCollection` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `imageUrl` VARCHAR(2000) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('PENDING','APPROVED','REJECTED','HIDDEN') NOT NULL DEFAULT 'PENDING',
  `moderationNote` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TrendyCollection_organizationId_key` (`organizationId`),
  INDEX `TrendyCollection_status_isActive_updatedAt_idx` (`status`, `isActive`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `TrendyCollection_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
