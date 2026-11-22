import { Router } from "express";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth";
import { createSupplierTestimonial, deleteSupplierTestimonial, listSupplierTestimonials, updateSupplierTestimonial } from "../controllers/testimonial.controller";
import { createCatalogItem, listMyCatalogItems, updateCatalogItem, deleteCatalogItem } from "../controllers/catalog.controller";
import { createCertification, listMyCertifications, updateCertification, deleteCertification } from "../controllers/certification.controller";
import {
  adminVerification, createPurchaseOrder, createRfq, deleteRfq, getPurchaseOrderDetails,
  getRfqDetails, inviteSupplier, listAdminOrganizations, listMyRfqs, listPurchaseOrders,
  submitQuote, supplierSearch, updateOrderStatus, upsertSupplierProfile,
  getOrganizationProfile, updateOrganizationProfile, updateQuotationStatus, reviseSupplierQuotation,
  listBusinessMedia, createBusinessMedia, deleteBusinessMedia, getPublicSupplierProfile
} from "../controllers/marketplace.controller";
const router = Router();

// Public / optional auth routes for supplier discovery
router.get("/suppliers", optionalAuthenticate, supplierSearch);
router.get("/suppliers/:organizationId/profile", optionalAuthenticate, getPublicSupplierProfile);

// Protected routes below
router.use(authenticate);
router.put("/supplier-profile", upsertSupplierProfile);
router.get("/catalog-items", listMyCatalogItems);
router.post("/catalog-items", createCatalogItem);
router.patch("/catalog-items/:itemId", updateCatalogItem);
router.delete("/catalog-items/:itemId", deleteCatalogItem);
router.get("/certifications", listMyCertifications);
router.get("/supplier-testimonials", listSupplierTestimonials);
router.post("/supplier-testimonials", createSupplierTestimonial);
router.patch("/supplier-testimonials/:testimonialId", updateSupplierTestimonial);
router.delete("/supplier-testimonials/:testimonialId", deleteSupplierTestimonial);
router.post("/certifications", createCertification);
router.patch("/certifications/:certificationId", updateCertification);
router.delete("/certifications/:certificationId", deleteCertification);
router.get("/organization-profile", getOrganizationProfile);
router.put("/organization-profile", updateOrganizationProfile);
router.get("/business-gallery", listBusinessMedia);
router.post("/business-gallery", createBusinessMedia);
router.delete("/business-gallery/:mediaId", deleteBusinessMedia);
router.post("/rfqs", createRfq);
router.get("/rfqs", listMyRfqs);
router.get("/rfqs/:rfqId", getRfqDetails);
router.delete("/rfqs/:rfqId", deleteRfq);
router.post("/rfqs/:rfqId/invitations", inviteSupplier);
router.post("/quotations", submitQuote);
router.put("/quotations/:quotationId", reviseSupplierQuotation);
router.patch("/quotations/:quotationId/status", updateQuotationStatus);
router.get("/purchase-orders", listPurchaseOrders);
router.get("/purchase-orders/:orderId", getPurchaseOrderDetails);
router.post("/purchase-orders", createPurchaseOrder);
router.patch("/purchase-orders/:orderId/status", updateOrderStatus);
router.get("/admin/organizations", requireRole("ADMIN"), listAdminOrganizations);
router.patch("/admin/organizations/:organizationId/verification", requireRole("ADMIN"), adminVerification);
export default router;