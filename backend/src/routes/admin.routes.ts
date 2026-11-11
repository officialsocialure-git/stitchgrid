import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  adminCatalog, adminDisputes, adminOrderDetails, adminOrders, adminOrganizationDetails, adminOverview, adminPayments, adminSupplierPaymentSetups,
  adminRfqDetails, adminRfqs, adminUpdateCatalogStatus, adminUpdateRfqStatus, adminUpdateUserStatus, adminUsers
} from "../controllers/admin.controller";
import { adminAuditLogs } from "../controllers/workflow.controller";
import { adminListPaymentRefunds, adminProcessPaymentRefund } from "../controllers/payment.controller";

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
router.get("/orders/:orderId", adminOrderDetails);
router.get("/payments", adminPayments);
router.get("/payment-setups", adminSupplierPaymentSetups);
router.get("/refunds", adminListPaymentRefunds);
router.patch("/refunds/:refundId", adminProcessPaymentRefund);
router.get("/disputes", adminDisputes);
router.get("/audit-logs", adminAuditLogs);

export default router;
