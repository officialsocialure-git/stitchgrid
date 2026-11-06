export type Role = "BUYER" | "SUPPLIER" | "ADMIN";

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface Organization {
  id: string;
  name: string;
  legalName?: string;
  businessType?: string;
  taxId?: string;
  city?: string;
  country?: string;
  verificationStatus: VerificationStatus;
}

export interface Membership {
  organizationId: string;
  role: Role;
  organization?: Organization;
}

export interface AuthState {
  user: User | null;
  activeMembership: Membership | null;
  accessToken: string | null;
}

export interface RfqItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
}

export interface Rfq {
  id: string;
  buyerOrgId: string;
  title: string;
  description?: string;
  garmentType?: string;
  fabricSpec?: string;
  targetPrice?: number;
  targetQuantity: number;
  targetDate?: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED" | "AWARDED";
  items: RfqItem[];
  quotations?: Quotation[];
  buyer?: { id: string; name: string; city?: string; country?: string };
  createdAt: string;
}

export interface QuotationItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  rfqItemId?: string;
}

export interface Quotation {
  id: string;
  rfqId: string;
  supplierOrgId: string;
  buyerOrgId: string;
  totalAmount: number;
  currency: string;
  leadTimeDays: number;
  validityUntil?: string;
  terms?: string;
  sampleCost?: number;
  sampleLeadDays?: number;
  moq?: number;
  status: "DRAFT" | "SUBMITTED" | "REVISED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  supplier?: { id: string; name: string; city?: string };
  items: QuotationItem[];
  createdAt: string;
}

export interface SupplierProfile {
  id: string;
  organizationId: string;
  description?: string;
  yearsInBusiness?: number;
  productionCapacity?: number;
  verificationStatus: VerificationStatus;
  organization: Organization;
  categories: { id: string; category: string }[];
  catalogItems: {
    id: string;
    name: string;
    description?: string;
    itemType: string;
    moq?: number;
    unitPrice?: number;
    currency: string;
  }[];
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  buyerOrgId: string;
  supplierOrgId: string;
  status: "PENDING_ACCEPTANCE" | "ACCEPTED" | "IN_PRODUCTION" | "QC" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  currency: string;
  expectedDate?: string;
  createdAt: string;
  supplier?: { id: string; name: string; city?: string };
  buyer?: { id: string; name: string };
  items?: { id?: string; name: string; quantity?: number; unitPrice?: number; unit?: string }[];
}

