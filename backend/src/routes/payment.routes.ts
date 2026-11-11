import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  createMilestoneCheckout,
  getOrCreatePaymentPlan,
  requestPaymentRefund,
  paymentDashboard,
  razorpayWebhook,
  reviewMilestoneProof,
  submitMilestoneProof,
  updateSupplierPaymentSetup,
  verifyMilestonePayment
} from "../controllers/payment.controller";

const router = Router();

// Razorpay signs the exact raw JSON bytes; this endpoint must stay unauthenticated.
router.post("/webhook", razorpayWebhook);

router.use(authenticate);
router.get("/dashboard", paymentDashboard);
router.post("/orders/:orderId/plan", requireRole("BUYER"), getOrCreatePaymentPlan);
router.post("/milestones/:milestoneId/checkout", requireRole("BUYER"), createMilestoneCheckout);
router.post("/verify", requireRole("BUYER"), verifyMilestonePayment);
router.post("/milestones/:milestoneId/proof", requireRole("SUPPLIER"), submitMilestoneProof);
router.post("/milestones/:milestoneId/review", requireRole("BUYER"), reviewMilestoneProof);
router.put("/supplier/setup", requireRole("SUPPLIER"), updateSupplierPaymentSetup);
router.post("/transactions/:transactionId/refunds", requireRole("BUYER"), requestPaymentRefund);

export default router;
