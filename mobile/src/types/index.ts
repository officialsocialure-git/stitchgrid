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
  rfq?: { id: string; title: string; targetQuantity: number };
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
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
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
  status: "PO_CREATED" | "PENDING_ACCEPTANCE" | "ACCEPTED" | "SAMPLE_PENDING" | "SAMPLE_APPROVED" | "PRODUCTION_STARTED" | "IN_PRODUCTION" | "QC_PENDING" | "QC" | "READY_TO_DISPATCH" | "DISPATCHED" | "DELIVERED" | "COMPLETED" | "CANCELLED";
  items: PurchaseOrderItem[];
  milestones: Milestone[];
  buyer?: { id: string; name: string; city?: string };
  supplier?: { id: string; name: string; city?: string };
  createdAt: string;
  expectedDate?: string;
}

export interface Sample {
  id: string;
  sampleNumber: string;
  purchaseOrderId?: string;
  rfqId?: string;
  buyerOrgId: string;
  supplierOrgId: string;
  sampleType: "PROTO" | "FIT" | "PP" | "TOP" | "SALESMAN";
  status: "REQUESTED" | "DISPATCHED" | "RECEIVED" | "APPROVED" | "REJECTED" | "REVISED";
  courierName?: string;
  trackingNumber?: string;
  dispatchDate?: string;
  deliveryDate?: string;
  feedback?: string;
  reviewDate?: string;
  createdAt: string;
  purchaseOrder?: { id: string; poNumber: string };
  supplier?: { id: string; name: string };
  buyer?: { id: string; name: string };
}

export interface Message {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderOrgId?: string;
  body: string;
  content?: string;
  attachmentUrls?: string[];
  createdAt: string;
  sender?: { id: string; fullName: string };
}

export interface Conversation {
  id: string;
  buyerOrgId: string;
  supplierOrgId: string;
  buyer?: { id: string; name: string; city?: string };
  supplier?: { id: string; name: string; city?: string };
  messages?: Message[];
  participantOrgIds?: string[];
  contextType?: string;
  contextId?: string;
  createdAt: string;
  updatedAt?: string;
  lastMessage?: string;
  otherPartyName?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  content?: string;
  readAt?: string | null;
  isRead?: boolean;
  type?: string;
  referenceId?: string;
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
    title: string;
    description?: string;
    imageUrl?: string;
    moq?: number;
    priceEstimate?: number;
  }[];
}

