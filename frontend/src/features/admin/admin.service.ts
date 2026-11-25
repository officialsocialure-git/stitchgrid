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
  user: (id: string) => api.get<any>(`/admin/users/${id}`),
  updateUser: (id: string, input: { fullName: string; email: string | null }) => api.patch(`/admin/users/${id}`, input),
  updateUserRole: (id: string, role: "BUYER" | "SUPPLIER" | "ADMIN") => api.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  organization: (id: string) => api.get<any>(`/admin/organizations/${id}`),
  organizationActivity: (id: string) => api.get<any[]>(`/admin/organizations/${id}/activity`),
  updateUserStatus: (id: string, isActive: boolean) => api.patch(`/admin/users/${id}/status`, { isActive }),
  marketplace: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/marketplace?${params.toString()}`),
  moderateCatalog: (id: string, status: "APPROVED" | "REJECTED", note?: string) => api.patch(`/admin/marketplace/${id}/moderation`, { status, note }),
  rfqs: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/rfqs?${params.toString()}`),
  rfq: (id: string) => api.get<any>(`/admin/rfqs/${id}`),
  updateRfqStatus: (id: string, status: "OPEN" | "CLOSED" | "CANCELLED") => api.patch(`/admin/rfqs/${id}/status`, { status }),
  orders: (params: URLSearchParams) => api.get<AdminPageResult & { stats?: any }>(`/admin/orders?${params.toString()}`),
  order: (id: string) => api.get<any>(`/admin/orders/${id}`),
  payments: (params: URLSearchParams) => api.get<AdminPageResult & { stats?: any }>(`/admin/payments?${params.toString()}`),
  paymentSetups: () => api.get<{ items: any[] }>("/admin/payment-setups"),
  reviewPaymentSetup: (id: string, decision: "APPROVE" | "REJECT", reason?: string) => api.patch(`/admin/payment-setups/${id}/review`, { decision, reason }),
  refunds: () => api.get<{ items: any[] }>("/admin/refunds"),
  processRefund: (id: string, decision: "APPROVE" | "REJECT", note?: string) => api.patch(`/admin/refunds/${id}`, { decision, note }),
  disputes: (params: URLSearchParams) => api.get<AdminPageResult>(`/admin/disputes?${params.toString()}`),
  auditLogs: () => api.get<any[]>("/admin/audit-logs"),
};
