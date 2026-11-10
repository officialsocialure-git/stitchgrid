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
  address?: string;
  country?: string;
  verificationStatus: VerificationStatus;
  supplierProfile?: any;
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
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED" | "AWARDED" | string;
  items: RfqItem[];
  quotations?: Quotation[];
  buyer?: { id: string; name: string; city?: string; country?: string };
  buyerOrg?: { id: string; name: string; city?: string };
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
  status: "DRAFT" | "SUBMITTED" | "REVISED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "PENDING" | string;
  supplier?: { id: string; name: string; city?: string };
  supplierOrg?: { id: string; name: string; city?: string };
  rfq?: { id: string; title: string; targetQuantity: number; buyer?: { name: string } };
  items: QuotationItem[];
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Milestone {
  id: string;
  title: string;
  orderIndex: number;
  targetDate?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | string;
  proofUrls?: string[];
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  buyerOrgId: string;
  supplierOrgId: string;
  quotationId?: string;
  totalAmount: number;
  currency: string;
  status: "PO_CREATED" | "PENDING_ACCEPTANCE" | "ACCEPTED" | "SAMPLE_PENDING" | "SAMPLE_APPROVED" | "PRODUCTION_STARTED" | "IN_PRODUCTION" | "QC_PENDING" | "QC" | "READY_TO_DISPATCH" | "DISPATCHED" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "ISSUED" | string;
  items: PurchaseOrderItem[];
  milestones: Milestone[];
  buyer?: { id: string; name: string; city?: string };
  buyerOrg?: { id: string; name: string; city?: string };
  supplier?: { id: string; name: string; city?: string };
  supplierOrg?: { id: string; name: string; city?: string };
  styleName?: string;
  notes?: string;
  createdAt: string;
  expectedDate?: string;
}

export interface Sample {
  id: string;
  sampleNumber?: string;
  purchaseOrderId?: string;
  rfqId?: string;
  buyerOrgId: string;
  supplierOrgId: string;
  sampleType?: "PROTO" | "FIT" | "PP" | "TOP" | "SALESMAN" | string;
  status: "REQUESTED" | "DISPATCHED" | "RECEIVED" | "APPROVED" | "REJECTED" | "REVISED" | "IN_PROGRESS" | "DELIVERED" | "REVISION_REQUIRED" | string;
  courierName?: string;
  trackingNumber?: string;
  dispatchDate?: string;
  deliveryDate?: string;
  feedback?: string;
  reviewDate?: string;
  notes?: string;
  order?: PurchaseOrder;
  createdAt: string;
}

export interface SupplierCategory {
  category: string;
}

export interface SupplierCatalogItem {
  id?: string;
  name: string;
  description?: string;
  unitPrice?: number;
  price?: string;
  minOrderQty?: number;
  moq?: number;
}

export interface SupplierProfile {
  id: string;
  organizationId: string;
  organization?: Organization;
  name?: string;
  city?: string;
  businessType?: string;
  verificationStatus?: string;
  yearsInBusiness?: number;
  productionCapacity?: number;
  capacity?: string;
  moq?: string;
  tags?: string;
  description?: string;
  categories?: SupplierCategory[];
  catalogItems?: SupplierCatalogItem[];
  catalog?: { name: string; price: string; moq?: number }[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderUserId?: string;
  senderOrgId?: string;
  body?: string;
  content?: string;
  sender?: { id: string; fullName: string };
  createdAt: string;
}

export interface Conversation {
  id: string;
  buyerOrgId: string;
  supplierOrgId: string;
  buyer?: { id: string; name: string; city?: string };
  supplier?: { id: string; name: string; city?: string };
  otherPartyName?: string;
  messages?: Message[];
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  content?: string;
  readAt: string | null;
  createdAt: string;
}
