CREATE TABLE `BusinessMedia` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `mediaType` ENUM('COMPANY_LOGO', 'COVER_PHOTO', 'COMPANY_PHOTO', 'FACTORY_PHOTO', 'WORK_PROCESS') NOT NULL,
  `url` VARCHAR(2000) NOT NULL,
  `fileName` VARCHAR(255) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `BusinessMedia_organizationId_mediaType_sortOrder_idx` (`organizationId`, `mediaType`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `BusinessMedia_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;