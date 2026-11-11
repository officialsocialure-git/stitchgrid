import { api } from "@/services/api";

export type AdminPageResult<T = any> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const adminService = {
  overview: () => api.get<any>("/admin/overview"),
  users: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/users?${params.toString()}`),
  organization: (id: string) => api.get<any>(`/admin/organizations/${id}`),
  updateUserStatus: (id: string, isActive: boolean) => api.patch(`/admin/users/${id}/status`, { isActive }),
  marketplace: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/marketplace?${params.toString()}`),
  moderateCatalog: (id: string, status: "APPROVED" | "REJECTED", note?: string) => api.patch(`/admin/marketplace/${id}/moderation`, { status, note }),
  rfqs: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/rfqs?${params.toString()}`),
  rfq: (id: string) => api.get<any>(`/admin/rfqs/${id}`),
  updateRfqStatus: (id: string, status: "OPEN" | "CLOSED" | "CANCELLED") => api.patch(`/admin/rfqs/${id}/status`, { status }),
  orders: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/orders?${params.toString()}`),
  payments: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/payments?${params.toString()}`),
  paymentSetups: () => api.get<{ items: any[] }>("/admin/payment-setups"),
  refunds: () => api.get<{ items: any[] }>("/admin/refunds"),
  processRefund: (id: string, decision: "APPROVE" | "REJECT", note?: string) => api.patch(`/admin/refunds/${id}`, { decision, note }),
  disputes: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/disputes?${params.toString()}`),
  auditLogs: () => api.get<any[]>("/admin/audit-logs"),
};
