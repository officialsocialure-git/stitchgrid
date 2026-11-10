import { api } from "./api";
import { SupplierProfile, Rfq, Quotation, PurchaseOrder, Sample, Message, Conversation } from "../types";

export const marketplaceService = {
  // 1. Supplier Discovery
  async searchSuppliers(params?: { category?: string; city?: string; q?: string }): Promise<SupplierProfile[]> {
    const query = new URLSearchParams();
    if (params?.q) query.append("q", params.q);
    if (params?.category && params.category !== "All") query.append("category", params.category);
    if (params?.city) query.append("city", params.city);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await api.get(`/suppliers${queryString}`);
    return res.data?.data || res.data;
  },

  // 2. RFQs
  async listMyRfqs(organizationId?: string): Promise<Rfq[]> {
    const param = organizationId ? `?organizationId=${organizationId}` : "";
    const res = await api.get(`/rfqs${param}`);
    return res.data?.data || res.data;
  },

  async getRfqDetails(rfqId: string): Promise<Rfq> {
    const res = await api.get(`/rfqs/${rfqId}`);
    return res.data?.data || res.data;
  },

  async deleteRfq(rfqId: string): Promise<{ deleted: boolean; id: string }> {
    const res = await api.delete(`/rfqs/${rfqId}`);
    return res.data?.data || res.data;
  },

  async createRfq(data: {
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
  }): Promise<Rfq> {
    const res = await api.post("/rfqs", data);
    return res.data?.data || res.data;
  },

  // 3. Quotations
  async submitQuote(data: {
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
  }): Promise<Quotation> {
    const res = await api.post("/quotations", data);
    return res.data?.data || res.data;
  },

  // 4. Purchase Orders
  async listOrders(): Promise<PurchaseOrder[]> {
    const res = await api.get("/purchase-orders");
    return res.data?.data || res.data;
  },

  async getOrderDetails(orderId: string): Promise<PurchaseOrder> {
    const res = await api.get(`/purchase-orders/${orderId}`);
    return res.data?.data || res.data;
  },

  async createPurchaseOrder(quotationId: string, expectedDate?: string): Promise<PurchaseOrder> {
    const res = await api.post("/purchase-orders", { quotationId, expectedDate });
    return res.data?.data || res.data;
  },

  async updateOrderStatus(
    orderId: string,
    status: string,
    options?: { note?: string; trackingNumber?: string; qcNotes?: string; dispatchDate?: string; deliveryDate?: string }
  ): Promise<PurchaseOrder> {
    const res = await api.patch(`/purchase-orders/${orderId}/status`, { status, ...options });
    return res.data?.data || res.data;
  },

  // 5. Milestones
  async updateMilestone(milestoneId: string, status: string, dueDate?: string): Promise<any> {
    const res = await api.patch(`/milestones/${milestoneId}`, { status, dueDate });
    return res.data?.data || res.data;
  },

  // 6. Samples
  async listSamples(): Promise<Sample[]> {
    const res = await api.get("/samples");
    return res.data?.data || res.data;
  },

  async createSample(orderId: string, notes?: string, sampleType?: string): Promise<Sample> {
    const res = await api.post(`/orders/${orderId}/samples`, { notes, sampleType });
    return res.data?.data || res.data;
  },

  async updateSample(
    sampleId: string,
    status?: string,
    options?: { notes?: string; photos?: { url: string; label: string }[]; feedback?: string }
  ): Promise<Sample> {
    const payload: any = {};
    if (status) payload.status = status;
    if (options?.notes !== undefined) payload.notes = options.notes;
    if (options?.photos !== undefined) payload.photos = options.photos;
    if (options?.feedback !== undefined) payload.feedback = options.feedback;
    const res = await api.patch(`/samples/${sampleId}`, payload);
    return res.data?.data || res.data;
  },

  // 7. Profile & Settings
  async updateOrganizationProfile(data: {
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
  }): Promise<any> {
    const res = await api.put("/organization-profile", data);
    return res.data?.data || res.data;
  },

  // 8. Conversations & Messages
  async listConversations(): Promise<Conversation[]> {
    const res = await api.get("/conversations");
    return res.data?.data || res.data;
  },

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const res = await api.get(`/conversations/${conversationId}/messages`);
    return res.data?.data || res.data;
  },

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const res = await api.post(`/conversations/${conversationId}/messages`, { body });
    return res.data?.data || res.data;
  },

  // 9. Payments
  async listPayments(): Promise<any[]> {
    const res = await api.get("/payments");
    return res.data?.data || res.data;
  },

  async createPayment(orderId: string, amount: number): Promise<any> {
    const res = await api.post(`/orders/${orderId}/payments`, { amount });
    return res.data?.data || res.data;
  },
};

