import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { createCatalogItem } from "../controllers/catalog.controller";
import {
  adminVerification, createPurchaseOrder, createRfq, deleteRfq, getPurchaseOrderDetails,
  getRfqDetails, inviteSupplier, listAdminOrganizations, listMyRfqs, listPurchaseOrders,
  submitQuote, supplierSearch, updateOrderStatus, upsertSupplierProfile,
  updateOrganizationProfile
} from "../controllers/marketplace.controller";
const router = Router();
router.use(authenticate);
router.get("/suppliers", supplierSearch);
router.put("/supplier-profile", upsertSupplierProfile);
router.post("/catalog-items", createCatalogItem);
router.put("/organization-profile", updateOrganizationProfile);
router.post("/rfqs", createRfq);
router.get("/rfqs", listMyRfqs);
router.get("/rfqs/:rfqId", getRfqDetails);
router.delete("/rfqs/:rfqId", deleteRfq);
router.post("/rfqs/:rfqId/invitations", inviteSupplier);
router.post("/quotations", submitQuote);
router.get("/purchase-orders", listPurchaseOrders);
router.get("/purchase-orders/:orderId", getPurchaseOrderDetails);
router.post("/purchase-orders", createPurchaseOrder);
router.patch("/purchase-orders/:orderId/status", updateOrderStatus);
router.get("/admin/organizations", requireRole("ADMIN"), listAdminOrganizations);
router.patch("/admin/organizations/:organizationId/verification", requireRole("ADMIN"), adminVerification);
export default router;