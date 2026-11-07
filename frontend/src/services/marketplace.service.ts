import { api } from "./api";
import { SupplierProfile, Rfq, Quotation, PurchaseOrder } from "@/types";

export const marketplaceService = {
  // 1. Supplier Discovery
  searchSuppliers: async (params?: { category?: string; city?: string; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.q) query.append("q", params.q);
    if (params?.category && params.category !== "All") query.append("category", params.category);
    if (params?.city) query.append("city", params.city);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return api.get<SupplierProfile[]>(`/suppliers${queryString}`);
  },

  // 2. RFQs
  listMyRfqs: async (organizationId?: string) => {
    const param = organizationId ? `?organizationId=${organizationId}` : "";
    return api.get<Rfq[]>(`/rfqs${param}`);
  },

  getRfqDetails: async (rfqId: string) => {
    return api.get<Rfq>(`/rfqs/${rfqId}`);
  },

  deleteRfq: async (rfqId: string) => {
    return api.delete<{ deleted: boolean; id: string }>(`/rfqs/${rfqId}`);
  },

  createRfq: async (data: {
    buyerOrgId: string;
    title: string;
    description?: string;
    garmentType?: string;
    fabricSpec?: string;
    targetPrice?: number;
    targetQuantity: number;
    targetDate?: string;
    status?: "DRAFT" | "OPEN";
    supplierOrgIds?: string[];
    items: { name: string; description?: string; quantity: number; unit: string }[];
  }) => {
    return api.post<Rfq>("/rfqs", data);
  },

  inviteSupplier: async (rfqId: string, supplierOrgId: string) => {
    return api.post(`/rfqs/${rfqId}/invitations`, { supplierOrgId });
  },

  // 3. Quotations
  submitQuote: async (data: {
    rfqId: string;
    supplierOrgId: string;
    totalAmount: number;
    currency?: string;
    leadTimeDays: number;
    validityUntil?: string;
    terms?: string;
    sampleCost?: number;
    sampleLeadDays?: number;
    moq?: number;
    items: { description: string; quantity: number; unitPrice: number; rfqItemId?: string }[];
  }) => {
    return api.post<Quotation>("/quotations", data);
  },

  // 4. Purchase Orders
  listOrders: async () => {
    return api.get<PurchaseOrder[]>("/purchase-orders");
  },

  getOrderDetails: async (orderId: string) => {
    return api.get<PurchaseOrder>(`/purchase-orders/${orderId}`);
  },

  createPurchaseOrder: async (quotationId: string, expectedDate?: string) => {
    return api.post<PurchaseOrder>("/purchase-orders", { quotationId, expectedDate });
  },

  updateOrderStatus: async (
    orderId: string,
    status: string,
    options?: { note?: string; trackingNumber?: string; qcNotes?: string; dispatchDate?: string; deliveryDate?: string }
  ) => {
    return api.patch<PurchaseOrder>(`/purchase-orders/${orderId}/status`, { status, ...options });
  },

  // 5. Production Milestones
  updateMilestone: async (milestoneId: string, status: string, dueDate?: string) => {
    return api.patch(`/milestones/${milestoneId}`, { status, dueDate });
  },

  // 6. Samples & File Uploads
  uploadFile: async (filename: string, data: string, label?: string) => {
    return api.post<{ url: string; filename: string; label: string; size: number }>("/upload", {
      filename,
      data,
      label,
    });
  },

  listSamples: async () => {
    return api.get<any[]>("/samples");
  },

  createSample: async (orderId: string, notes?: string, sampleType?: string) => {
    return api.post(`/orders/${orderId}/samples`, { notes, sampleType });
  },

  updateSample: async (
    sampleId: string,
    status?: string,
    options?:
      | {
          notes?: string;
          photos?: { url: string; label: string }[];
          feedback?: string;
        }
      | string
  ) => {
    const payload: any = {};
    if (status) payload.status = status;
    if (typeof options === "string") {
      payload.notes = options;
    } else if (options && typeof options === "object") {
      if (options.notes !== undefined) payload.notes = options.notes;
      if (options.photos !== undefined) payload.photos = options.photos;
      if (options.feedback !== undefined) payload.feedback = options.feedback;
    }
    return api.patch(`/samples/${sampleId}`, payload);
  },

  createCatalogItem: async (data: { organizationId: string; name: string; itemType: string; description?: string; moq?: number; unitPrice?: number; currency?: string }) => {
    return api.post<any>("/catalog-items", data);
  },

  // 6b. Profile & Organization Settings
  updateOrganizationProfile: async (data: {
    organizationId: string;
    name?: string;
    legalName?: string;
    businessType?: string;
    taxId?: string;
    city?: string;
    address?: string;
    country?: string;
    description?: string;
    yearsInBusiness?: number;
    productionCapacity?: number;
    categories?: string[];
  }) => {
    return api.put("/organization-profile", data);
  },

  // 7. Messaging
  listConversations: async () => {
    return api.get<any[]>("/conversations");
  },

  getConversationMessages: async (conversationId: string) => {
    return api.get<any[]>(`/conversations/${conversationId}/messages`);
  },

  sendMessage: async (conversationId: string, body: string) => {
    return api.post(`/conversations/${conversationId}/messages`, { body });
  },

  // 8. Payments & Escrow
  listPayments: async () => {
    return api.get<any[]>("/payments");
  },

  createPayment: async (orderId: string, amount: number) => {
    return api.post(`/orders/${orderId}/payments`, { amount });
  },

  // 9. Admin Functions
  listAdminOrganizations: async () => {
    return api.get<any[]>("/admin/organizations");
  },

  updateVerificationStatus: async (organizationId: string, status: "APPROVED" | "REJECTED", note?: string) => {
    return api.patch(`/admin/organizations/${organizationId}/verification`, { status, note });
  },
};
