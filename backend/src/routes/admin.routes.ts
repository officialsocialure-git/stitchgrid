import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  adminCatalog, adminDisputes, adminOrderDetails, adminOrders, adminOrganizationActivity, adminOrganizationDetails, adminOverview, adminPayments, adminSupplierPaymentSetups, adminReviewSupplierPaymentSetup,
  adminRfqDetails, adminRfqs, adminUpdateRfqStatus, adminUpdateUserStatus, adminUsers,
  adminUserDetails, adminUpdateUser, adminUpdateUserRole, adminDeleteUser, adminUpdateCatalogStatus
} from "../controllers/admin.controller";
import { adminAuditLogs } from "../controllers/workflow.controller";
import { adminListPaymentRefunds, adminProcessPaymentRefund } from "../controllers/payment.controller";
import { adminCertifications, adminReviewCertification } from "../controllers/admin-certification.controller";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));
router.get("/overview", adminOverview);
router.get("/users", adminUsers);
router.get("/users/:userId", adminUserDetails);
router.patch("/users/:userId", adminUpdateUser);
router.patch("/users/:userId/role", adminUpdateUserRole);
router.patch("/users/:userId/status", adminUpdateUserStatus);
router.delete("/users/:userId", adminDeleteUser);
router.get("/organizations/:organizationId/activity", adminOrganizationActivity);
router.get("/organizations/:organizationId", adminOrganizationDetails);
router.get("/marketplace", adminCatalog);
router.patch("/marketplace/:itemId/moderation", adminUpdateCatalogStatus);
router.get("/certifications", adminCertifications);
router.patch("/certifications/:certificationId/review", adminReviewCertification);
router.get("/rfqs", adminRfqs);
router.get("/rfqs/:rfqId", adminRfqDetails);
router.patch("/rfqs/:rfqId/status", adminUpdateRfqStatus);
router.get("/orders", adminOrders);
router.get("/orders/:orderId", adminOrderDetails);
router.get("/payments", adminPayments);
router.get("/payment-setups", adminSupplierPaymentSetups);
router.patch("/payment-setups/:profileId/review", adminReviewSupplierPaymentSetup);
router.get("/refunds", adminListPaymentRefunds);
router.patch("/refunds/:refundId", adminProcessPaymentRefund);
router.get("/disputes", adminDisputes);
router.get("/audit-logs", adminAuditLogs);

export default router;
