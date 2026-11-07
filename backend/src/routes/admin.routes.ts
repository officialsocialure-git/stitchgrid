import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  adminCatalog, adminDisputes, adminOrders, adminOrganizationDetails, adminOverview, adminPayments,
  adminRfqDetails, adminRfqs, adminUpdateCatalogStatus, adminUpdateRfqStatus, adminUpdateUserStatus, adminUsers
} from "../controllers/admin.controller";
import { adminAuditLogs } from "../controllers/workflow.controller";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));
router.get("/overview", adminOverview);
router.get("/users", adminUsers);
router.get("/organizations/:organizationId", adminOrganizationDetails);
router.patch("/users/:userId/status", adminUpdateUserStatus);
router.get("/marketplace", adminCatalog);
router.patch("/marketplace/:itemId/moderation", adminUpdateCatalogStatus);
router.get("/rfqs", adminRfqs);
router.get("/rfqs/:rfqId", adminRfqDetails);
router.patch("/rfqs/:rfqId/status", adminUpdateRfqStatus);
router.get("/orders", adminOrders);
router.get("/payments", adminPayments);
router.get("/disputes", adminDisputes);
router.get("/audit-logs", adminAuditLogs);

export default router;
