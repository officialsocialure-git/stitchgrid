import { api } from "@/services/api";

export type PaymentMilestone = {
  id: string;
  title: string;
  sequence: number;
  percentage: string | number;
  amount: string | number;
  status: string;
  proofUrl?: string | null;
  completionNote?: string | null;
  rejectionReason?: string | null;
};

export const paymentService = {
  dashboard: () => api.get<any>("/payments/dashboard"),
  ensurePlan: (orderId: string) => api.post<any>(`/payments/orders/${orderId}/plan`, {}),
  createCheckout: (milestoneId: string) => api.post<any>(`/payments/milestones/${milestoneId}/checkout`, {}),
  verify: (payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => api.post<any>("/payments/verify", payload),
  submitProof: (milestoneId: string, proofUrl: string, note?: string) => api.post<any>(`/payments/milestones/${milestoneId}/proof`, { proofUrl, note }),
  reviewProof: (milestoneId: string, decision: "APPROVE" | "REJECT", reason?: string) => api.post<any>(`/payments/milestones/${milestoneId}/review`, { decision, reason }),
  updateSupplierSetup: (payload: { accountHolderName: string; bankName: string; bankAccountLast4: string; ifscMasked: string }) => api.put<any>("/payments/supplier/setup", payload),
  requestRefund: (transactionId: string, reason: string) => api.post<any>(`/payments/transactions/${transactionId}/refunds`, { reason })
};
