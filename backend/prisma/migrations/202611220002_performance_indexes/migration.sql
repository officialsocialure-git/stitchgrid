-- Add indexes for organization-scoped order feeds and conversation/message reads.
CREATE INDEX `PurchaseOrder_buyerOrgId_createdAt_idx` ON `PurchaseOrder`(`buyerOrgId`, `createdAt`);
CREATE INDEX `PurchaseOrder_supplierOrgId_createdAt_idx` ON `PurchaseOrder`(`supplierOrgId`, `createdAt`);
CREATE INDEX `Conversation_buyerOrgId_createdAt_idx` ON `Conversation`(`buyerOrgId`, `createdAt`);
CREATE INDEX `Conversation_supplierOrgId_createdAt_idx` ON `Conversation`(`supplierOrgId`, `createdAt`);
CREATE INDEX `Message_conversationId_createdAt_idx` ON `Message`(`conversationId`, `createdAt`);
