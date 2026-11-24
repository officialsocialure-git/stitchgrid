ALTER TABLE `PurchaseOrder`
  ADD COLUMN `deliveryAddressStatus` VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN `deliveryRecipientName` VARCHAR(160) NULL,
  ADD COLUMN `deliveryPhone` VARCHAR(30) NULL,
  ADD COLUMN `deliveryAddressLine` TEXT NULL,
  ADD COLUMN `deliveryCity` VARCHAR(120) NULL,
  ADD COLUMN `deliveryState` VARCHAR(120) NULL,
  ADD COLUMN `deliveryPostalCode` VARCHAR(20) NULL,
  ADD COLUMN `deliveryCountry` VARCHAR(100) NULL,
  ADD COLUMN `deliveryLatitude` DOUBLE NULL,
  ADD COLUMN `deliveryLongitude` DOUBLE NULL,
  ADD COLUMN `deliveryAddressRequestedAt` DATETIME(3) NULL,
  ADD COLUMN `deliveryAddressSubmittedAt` DATETIME(3) NULL;
