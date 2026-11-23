CREATE TABLE `CatalogItemImage` (
  `id` VARCHAR(191) NOT NULL,
  `catalogItemId` VARCHAR(191) NOT NULL,
  `imageUrl` VARCHAR(2000) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CatalogItemImage_catalogItemId_sortOrder_idx` (`catalogItemId`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CatalogItemImage_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
