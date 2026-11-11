ALTER TABLE `PaymentTransaction`
  ADD COLUMN `paymentMilestoneId` VARCHAR(191) NULL,
  ADD COLUMN `razorpayOrderId` VARCHAR(191) NULL,
  ADD COLUMN `razorpayPaymentId` VARCHAR(191) NULL,
  ADD COLUMN `transferId` VARCHAR(191) NULL,
  ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
  ADD COLUMN `signatureVerified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `commissionAmount` DECIMAL(12,2) NULL,
  ADD COLUMN `capturedAt` DATETIME(3) NULL,
  ADD COLUMN `settledAt` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ADD UNIQUE INDEX `PaymentTransaction_razorpayOrderId_key` (`razorpayOrderId`),
  ADD UNIQUE INDEX `PaymentTransaction_razorpayPaymentId_key` (`razorpayPaymentId`),
  ADD UNIQUE INDEX `PaymentTransaction_transferId_key` (`transferId`),
  ADD INDEX `PaymentTransaction_purchaseOrderId_status_idx` (`purchaseOrderId`, `status`),
  ADD INDEX `PaymentTransaction_paymentMilestoneId_idx` (`paymentMilestoneId`);

CREATE TABLE `PaymentPlan` (
  `id` VARCHAR(191) NOT NULL,
  `purchaseOrderId` VARCHAR(191) NOT NULL,
  `totalAmount` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  `status` ENUM('ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PaymentPlan_purchaseOrderId_key` (`purchaseOrderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PaymentMilestone` (
  `id` VARCHAR(191) NOT NULL,
  `paymentPlanId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `percentage` DECIMAL(5,2) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` ENUM('UPCOMING','DUE','PAYMENT_PENDING','PAID','PROOF_SUBMITTED','APPROVED','REJECTED','RELEASE_PENDING','RELEASED','DISPUTED','REFUNDED','FAILED') NOT NULL DEFAULT 'UPCOMING',
  `dueDate` DATETIME(3) NULL,
  `proofUrl` TEXT NULL,
  `completionNote` TEXT NULL,
  `submittedAt` DATETIME(3) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectionReason` TEXT NULL,
  `releasedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PaymentMilestone_paymentPlanId_sequence_key` (`paymentPlanId`, `sequence`),
  INDEX `PaymentMilestone_paymentPlanId_status_idx` (`paymentPlanId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupplierPaymentProfile` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `razorpayAccountId` VARCHAR(191) NULL,
  `status` ENUM('NOT_STARTED','PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'NOT_STARTED',
  `kycStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
  `settlementStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
  `accountHolderName` VARCHAR(191) NULL,
  `bankName` VARCHAR(191) NULL,
  `bankAccountLast4` VARCHAR(191) NULL,
  `ifscMasked` VARCHAR(191) NULL,
  `rejectionReason` TEXT NULL,
  `submittedAt` DATETIME(3) NULL,
  `verifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupplierPaymentProfile_organizationId_key` (`organizationId`),
  UNIQUE INDEX `SupplierPaymentProfile_razorpayAccountId_key` (`razorpayAccountId`),
  INDEX `SupplierPaymentProfile_status_updatedAt_idx` (`status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PaymentWebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `signatureValid` BOOLEAN NOT NULL DEFAULT false,
  `processedAt` DATETIME(3) NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PaymentWebhookEvent_eventId_key` (`eventId`),
  INDEX `PaymentWebhookEvent_eventType_createdAt_idx` (`eventType`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PaymentRefund` (
  `id` VARCHAR(191) NOT NULL,
  `paymentTransactionId` VARCHAR(191) NOT NULL,
  `providerRefundId` VARCHAR(191) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PaymentRefund_providerRefundId_key` (`providerRefundId`),
  INDEX `PaymentRefund_paymentTransactionId_status_idx` (`paymentTransactionId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentPlan`
  ADD CONSTRAINT `PaymentPlan_purchaseOrderId_fkey`
  FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PaymentMilestone`
  ADD CONSTRAINT `PaymentMilestone_paymentPlanId_fkey`
  FOREIGN KEY (`paymentPlanId`) REFERENCES `PaymentPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SupplierPaymentProfile`
  ADD CONSTRAINT `SupplierPaymentProfile_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PaymentTransaction`
  ADD CONSTRAINT `PaymentTransaction_purchaseOrderId_fkey`
  FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PaymentTransaction_paymentMilestoneId_fkey`
  FOREIGN KEY (`paymentMilestoneId`) REFERENCES `PaymentMilestone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PaymentRefund`
  ADD CONSTRAINT `PaymentRefund_paymentTransactionId_fkey`
  FOREIGN KEY (`paymentTransactionId`) REFERENCES `PaymentTransaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve old simulated rows without presenting them as real provider-funded escrow.
UPDATE `PaymentTransaction` SET `provider` = 'LEGACY_SIMULATED', `status` = 'LEGACY_UNVERIFIED' WHERE `provider` = 'ESCROW_VAULT' AND `status` = 'HELD_IN_ESCROW';
