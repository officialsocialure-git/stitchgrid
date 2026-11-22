CREATE TABLE `SupplierTestimonial` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(150) NOT NULL,
  `rating` INTEGER NOT NULL,
  `comment` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `SupplierTestimonial_organizationId_createdAt_idx` (`organizationId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupplierTestimonial_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;