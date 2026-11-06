import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  adminAuditLogs, adminListOrganizations, createConversation, createDispute, createPayment,
  createReview, createSample, getConversationMessages, listConversations, listNotifications,
  listPayments, listSamples, markNotificationRead, resolveDispute, sendMessage,
  updateMilestone, updateSample, uploadFile
} from "../controllers/workflow.controller";
const router = Router();
router.use(authenticate);
router.post("/upload", uploadFile);
router.get("/samples", listSamples);
router.post("/orders/:orderId/samples", createSample);
router.patch("/samples/:sampleId", updateSample);
router.patch("/milestones/:milestoneId", updateMilestone);
router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.get("/payments", listPayments);
router.post("/orders/:orderId/payments", createPayment);
router.get("/notifications", listNotifications);
router.patch("/notifications/:notificationId/read", markNotificationRead);
router.post("/orders/:orderId/disputes", createDispute);
router.patch("/admin/disputes/:disputeId", requireRole("ADMIN"), resolveDispute);
router.post("/orders/:orderId/reviews", createReview);
router.get("/admin/organizations", requireRole("ADMIN"), adminListOrganizations);
router.get("/admin/audit-logs", requireRole("ADMIN"), adminAuditLogs);
export default router;