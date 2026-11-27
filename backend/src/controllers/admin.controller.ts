import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { invalidateCachePattern } from "../services/cache";
import { emitToOrg, emitToRole } from "../services/realtime";

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().optional(),
});

export async function adminOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const [users, buyers, suppliers, openRfqs, activeOrders, pendingVerifications, openDisputes, paidTransactions, pendingTransactions, pendingPaymentSetups, openRefundRequests, recentActivity] = await Promise.all([
      prisma.user.count(),
      prisma.organizationMember.count({ where: { role: "BUYER", isActive: true } }),
      prisma.organizationMember.count({ where: { role: "SUPPLIER", isActive: true } }),
      prisma.rfq.count({ where: { status: "OPEN" } }),
      prisma.purchaseOrder.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      prisma.organization.count({ where: { verificationStatus: "PENDING", members: { some: { role: "SUPPLIER", isActive: true } } } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.paymentTransaction.count({ where: { provider: "RAZORPAY", status: "PAID" } }),
      prisma.paymentTransaction.count({ where: { provider: "RAZORPAY", status: "PENDING" } }),
      prisma.supplierPaymentProfile.count({ where: { status: "PENDING" } }),
      prisma.paymentRefund.count({ where: { status: "REQUESTED" } }),
      prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true, email: true } } } }),
    ]);
    return sendOk(res, { users, buyers, suppliers, openRfqs, activeOrders, pendingVerifications, openDisputes, paidTransactions, pendingTransactions, pendingPaymentSetups, openRefundRequests, recentActivity });
  } catch (error) { next(error); }
}

export async function adminOrganizationDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: String(req.params.organizationId) },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } } } },
        supplierProfile: { include: { categories: true, capabilities: true, catalogItems: true, certifications: true } },
        businessMedia: { orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }] },
        supplierPaymentProfile: { select: { status: true, kycStatus: true, settlementStatus: true, accountHolderName: true, bankName: true, bankAccountLast4: true, ifscMasked: true, rejectionReason: true, submittedAt: true, verifiedAt: true } },
        _count: { select: { rfqs: true, buyerOrders: true, supplierOrders: true } }
      }
    });
    if (!organization) throw new AppError(404, "Business profile not found");
    return sendOk(res, organization);
  } catch (error) { next(error); }
}

export async function adminOrganizationActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.params.organizationId || "").trim();
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new AppError(404, "Business profile not found");
    const activity = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Organization", entityId: organizationId },
          { organizationId }
        ]
      },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return sendOk(res, activity);
  } catch (error) { next(error); }
}

export async function adminUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.extend({
      role: z.enum(["ALL", "BUYER", "SUPPLIER", "ADMIN"]).default("ALL"),
      active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
      verification: z.enum(["ALL", "APPROVED", "PENDING", "REJECTED", "N/A"]).default("ALL"),
      joinedFrom: z.coerce.date().optional(),
      joinedTo: z.coerce.date().optional(),
      lastActive: z.enum(["ALL", "7D", "30D"]).default("ALL")
    }).parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [
      { fullName: { contains: parsed.q } }, { email: { contains: parsed.q } }, { phone: { contains: parsed.q } },
      { memberships: { some: { organization: { name: { contains: parsed.q } } } } }
    ];
    const membershipFilters: any[] = [];
    if (parsed.role !== "ALL") membershipFilters.push({ role: parsed.role, isActive: true });
    if (parsed.verification === "N/A") {
      where.AND = [...(where.AND || []), { memberships: { none: {} } }];
    } else if (parsed.verification !== "ALL") {
      membershipFilters.push({ organization: { is: { verificationStatus: parsed.verification } } });
    }
    if (membershipFilters.length) where.memberships = { some: { AND: membershipFilters } };
    if (parsed.active !== "ALL") where.isActive = parsed.active === "ACTIVE";
    if (parsed.joinedFrom || parsed.joinedTo) {
      where.createdAt = {
        ...(parsed.joinedFrom ? { gte: parsed.joinedFrom } : {}),
        ...(parsed.joinedTo ? { lte: parsed.joinedTo } : {})
      };
    }
    if (parsed.lastActive !== "ALL") {
      const days = parsed.lastActive === "7D" ? 7 : 30;
      where.auditLogs = { some: { action: { in: ["AUTH_LOGIN", "AUTH_LOGIN_GOOGLE"] }, createdAt: { gte: new Date(Date.now() - days * 86400000) } } };
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          memberships: { include: { organization: { select: { id: true, name: true, verificationStatus: true } } } },
          auditLogs: { where: { action: { in: ["AUTH_LOGIN", "AUTH_LOGIN_GOOGLE"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.user.count({ where })
    ]);
    return sendOk(res, { items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
  } catch (error) { next(error); }
}

export async function adminUpdateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const userId = String(req.params.userId);
    if (userId === req.auth?.userId && !isActive) throw new AppError(400, "You cannot deactivate your own admin account");
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { memberships: true } });
    if (!target) throw new AppError(404, "User not found");
    if (!isActive && target.memberships.some(m => m.role === "ADMIN" && m.isActive)) {
      const activeAdminMemberships = await prisma.organizationMember.findMany({ where: { role: "ADMIN", isActive: true }, select: { userId: true }, distinct: ["userId"] });
      if (activeAdminMemberships.length <= 1) throw new AppError(400, "The last active admin cannot be deactivated");
    }
    const updated = await prisma.user.update({ where: { id: userId }, data: { isActive } });
    await audit("ADMIN_USER_STATUS_UPDATED", "User", userId, req.auth!.userId, undefined, { isActive });
    return sendOk(res, { id: updated.id, isActive: updated.isActive });
  } catch (error) { next(error); }
}



export async function adminUserDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = String(req.params.userId);
    const [user, activity] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, fullName: true, email: true, phone: true, isActive: true,
          emailVerified: true, phoneVerified: true, createdAt: true, updatedAt: true,
          memberships: { include: { organization: { select: { id: true, name: true, verificationStatus: true } } } }
        }
      }),
      prisma.auditLog.findMany({
        where: { OR: [{ actorUserId: userId }, { entityType: "User", entityId: userId }] },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true }
      })
    ]);
    if (!user) throw new AppError(404, "User not found");
    return sendOk(res, { ...user, activity });
  } catch (error) { next(error); }
}

export async function adminUpdateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(190).nullable()
    }).parse(req.body);
    const userId = String(req.params.userId);
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!target) throw new AppError(404, "User not found");
    if (input.email) {
      const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existing && existing.id !== userId) throw new AppError(409, "This email address is already used by another account.");
    }
    const emailChanged = (input.email || null) !== target.email;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { fullName: input.fullName, email: input.email || null, ...(emailChanged ? { emailVerified: false } : {}) },
      select: { id: true, fullName: true, email: true, phone: true, isActive: true, emailVerified: true, createdAt: true, updatedAt: true }
    });
    await audit("ADMIN_USER_PROFILE_UPDATED", "User", userId, req.auth!.userId, undefined, { fullName: input.fullName, emailChanged });
    emitToRole("ADMIN", "admin:user_updated", { userId });
    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function adminUpdateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = z.object({ role: z.enum(["BUYER", "SUPPLIER", "ADMIN"]) }).parse(req.body);
    const userId = String(req.params.userId);
    if (userId === req.auth?.userId && role !== "ADMIN") throw new AppError(400, "You cannot change your own administrator role.");
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { isActive: true } } }
    });
    if (!target) throw new AppError(404, "User not found");
    if (target.memberships.length !== 1) {
      throw new AppError(409, "Role can only be changed when the user has exactly one active organization membership. Review memberships first.");
    }
    const current = target.memberships[0];
    if (current.role === role) return sendOk(res, { id: userId, role });
    if (current.role === "ADMIN" && role !== "ADMIN") {
      const activeAdmins = await prisma.organizationMember.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { userId: true },
        distinct: ["userId"]
      });
      if (activeAdmins.length <= 1) throw new AppError(400, "The last active administrator cannot be demoted.");
    }
    await prisma.$transaction(async (tx) => {
      const existingMembership = await tx.organizationMember.findUnique({
        where: { userId_organizationId_role: { userId, organizationId: current.organizationId, role } }
      });
      await tx.organizationMember.update({ where: { id: current.id }, data: { isActive: false } });
      if (existingMembership) {
        await tx.organizationMember.update({ where: { id: existingMembership.id }, data: { isActive: true } });
      } else {
        await tx.organizationMember.update({ where: { id: current.id }, data: { role, isActive: true } });
      }
      await tx.auditLog.create({
        data: {
          action: "ADMIN_USER_ROLE_UPDATED",
          entityType: "User",
          entityId: userId,
          actorUserId: req.auth!.userId,
          organizationId: current.organizationId,
          metadata: { previousRole: current.role, role }
        }
      });
    });
    emitToOrg(current.organizationId, "admin:user_updated", { userId });
    emitToRole("ADMIN", "admin:user_updated", { userId });
    return sendOk(res, { id: userId, role });
  } catch (error) { next(error); }
}

export async function adminDeleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = String(req.params.userId);
    if (userId === req.auth?.userId) throw new AppError(400, "You cannot delete your own administrator account.");
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, memberships: { select: { id: true } } } });
    if (!target) throw new AppError(404, "User not found");
    const [messageCount, disputeCount, orderEventCount, qualityReportCount] = await Promise.all([
      prisma.message.count({ where: { senderUserId: userId } }),
      prisma.dispute.count({ where: { raisedByUserId: userId } }),
      prisma.orderEvent.count({ where: { actorUserId: userId } }),
      prisma.qualityCheckReport.count({ where: { OR: [{ supplierUserId: userId }, { reviewedByUserId: userId }] } })
    ]);
    if (target.memberships.length || messageCount || disputeCount || orderEventCount || qualityReportCount) {
      throw new AppError(409, "This account is linked to organization or business activity. Deactivate it instead to preserve STITCHGRID records.");
    }
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ]);
    await audit("ADMIN_USER_DELETED", "User", userId, req.auth!.userId);
    emitToRole("ADMIN", "admin:user_updated", { userId });
    return sendOk(res, { id: userId, deleted: true });
  } catch (error) { next(error); }
}

export async function adminCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.extend({
      category: z.string().optional(),
      dateRange: z.enum(["ALL", "7D", "30D", "90D"]).default("ALL")
    }).parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [{ name: { contains: parsed.q } }, { description: { contains: parsed.q } }, { supplierProfile: { organization: { name: { contains: parsed.q } } } }];
    if (parsed.category && parsed.category !== "ALL") where.itemType = parsed.category;
    if (parsed.status && parsed.status !== "ALL") where.moderationStatus = parsed.status;
    if (parsed.dateRange !== "ALL") {
      const days = parsed.dateRange === "7D" ? 7 : parsed.dateRange === "30D" ? 30 : 90;
      where.createdAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    const [items, total, totalListings, pending, approved, rejected, categories] = await Promise.all([
      prisma.catalogItem.findMany({ where, include: { images: { orderBy: { sortOrder: "asc" } }, priceTiers: { orderBy: { minQuantity: "asc" } }, supplierProfile: { include: { organization: { select: { id: true, name: true, city: true, verificationStatus: true } } } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.catalogItem.count({ where }),
      prisma.catalogItem.count(),
      prisma.catalogItem.count({ where: { moderationStatus: "PENDING" } }),
      prisma.catalogItem.count({ where: { moderationStatus: "APPROVED" } }),
      prisma.catalogItem.count({ where: { moderationStatus: "REJECTED" } }),
      prisma.catalogItem.findMany({ distinct: ["itemType"], select: { itemType: true }, orderBy: { itemType: "asc" } })
    ]);
    return sendOk(res, { items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit), stats: { total: totalListings, pending, approved, rejected }, categories: categories.map(c => c.itemType) });
  } catch (error) { next(error); }
}

export async function adminUpdateCatalogStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(2000).optional() }).parse(req.body);
    const itemId = String(req.params.itemId);
    const existing = await prisma.catalogItem.findUnique({
      where: { id: itemId },
      include: { supplierProfile: { include: { organization: { select: { id: true, verificationStatus: true } } } } }
    });
    if (!existing) throw new AppError(404, "Product not found");
    if (input.status === "APPROVED" && existing.supplierProfile.organization.verificationStatus !== "APPROVED") {
      throw new AppError(409, "Supplier organization must be verified before its product can be approved");
    }
    const item = await prisma.catalogItem.update({
      where: { id: itemId },
      data: { moderationStatus: input.status, moderationNote: input.note || null, isActive: input.status === "APPROVED" }
    });
    await audit("ADMIN_CATALOG_MODERATION", "CatalogItem", item.id, req.auth!.userId, existing.supplierProfile.organization.id, { status: input.status, note: input.note });
    await invalidateCachePattern("cache:suppliers:");
    emitToRole("SUPPLIER", "catalog:moderated", { itemId: item.id, organizationId: existing.supplierProfile.organization.id, status: item.moderationStatus });
    emitToRole("BUYER", "catalog:updated", { itemId: item.id, status: item.moderationStatus });
    return sendOk(res, item);
  } catch (error) { next(error); }
}

export async function adminRfqs(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.extend({
      category: z.string().trim().optional(),
      dateRange: z.enum(["ALL", "7D", "30D", "90D"]).optional()
    }).parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [
      { title: { contains: parsed.q } },
      { id: { contains: parsed.q } },
      { garmentType: { contains: parsed.q } },
      { buyer: { name: { contains: parsed.q } } },
      { items: { some: { name: { contains: parsed.q } } } }
    ];
    if (parsed.category && parsed.category !== "ALL") where.garmentType = parsed.category;
    if (parsed.dateRange && parsed.dateRange !== "ALL") {
      const days = parsed.dateRange === "7D" ? 7 : parsed.dateRange === "30D" ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.createdAt = { gte: since };
    }
    if (parsed.status === "IN_PROGRESS") {
      where.status = "OPEN";
      where.quotations = { some: {} };
    } else if (parsed.status === "OPEN") {
      where.status = "OPEN";
      where.quotations = { none: {} };
    } else if (parsed.status && parsed.status !== "ALL" && parsed.status !== "CLOSED") {
      where.status = parsed.status;
    } else if (parsed.status === "CLOSED") {
      where.status = { in: ["CLOSED", "CANCELLED"] };
    }
    const statsWhere: any = {};
    const [items, total, totalRfqs, openRfqs, inProgressRfqs, awardedRfqs, closedRfqs, categories] = await Promise.all([
      prisma.rfq.findMany({ where, include: { buyer: { select: { id: true, name: true, city: true } }, items: true, quotations: { include: { supplier: { select: { id: true, name: true } } } }, _count: { select: { quotations: true, invitations: true } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.rfq.count({ where }),
      prisma.rfq.count({ where: statsWhere }),
      prisma.rfq.count({ where: { status: "OPEN", quotations: { none: {} } } }),
      prisma.rfq.count({ where: { status: "OPEN", quotations: { some: {} } } }),
      prisma.rfq.count({ where: { status: "AWARDED" } }),
      prisma.rfq.count({ where: { status: { in: ["CLOSED", "CANCELLED"] } } }),
      prisma.rfq.findMany({ distinct: ["garmentType"], where: { garmentType: { not: null } }, select: { garmentType: true }, orderBy: { garmentType: "asc" } })
    ]);
    return sendOk(res, {
      items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit),
      stats: { total: totalRfqs, open: openRfqs, inProgress: inProgressRfqs, awarded: awardedRfqs, closed: closedRfqs },
      categories: categories.map(item => item.garmentType).filter(Boolean)
    });
  } catch (error) { next(error); }
}

export async function adminRfqDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const rfq = await prisma.rfq.findUnique({
      where: { id: String(req.params.rfqId) },
      include: {
        buyer: { select: { id: true, name: true, city: true, taxId: true } },
        items: true,
        quotations: { include: { supplier: { select: { id: true, name: true, city: true } }, items: true } },
        invitations: true
      }
    });
    if (!rfq) throw new AppError(404, "RFQ not found");
    return sendOk(res, rfq);
  } catch (error) { next(error); }
}

export async function adminUpdateRfqStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = z.object({ status: z.enum(["OPEN", "CLOSED", "CANCELLED"]) }).parse(req.body);
    const rfqId = String(req.params.rfqId);
    const rfq = await prisma.rfq.update({ where: { id: rfqId }, data: { status } });
    await audit("ADMIN_RFQ_STATUS_UPDATED", "Rfq", rfqId, req.auth!.userId, rfq.buyerOrgId, { status });
    return sendOk(res, rfq);
  } catch (error) { next(error); }
}

export async function adminOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.extend({
      paymentStatus: z.string().trim().optional(),
      dateRange: z.enum(["ALL", "7D", "30D", "90D"]).default("ALL")
    }).parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [
      { poNumber: { contains: parsed.q } },
      { buyer: { name: { contains: parsed.q } } },
      { supplier: { name: { contains: parsed.q } } }
    ];
    if (parsed.status && parsed.status !== "ALL") {
      if (parsed.status === "SAMPLE") where.samples = { some: {} };
      else if (parsed.status === "PRODUCTION") where.status = { in: ["PRODUCTION_STARTED", "IN_PRODUCTION"] };
      else if (parsed.status === "QC") where.status = { in: ["QC_PENDING", "QC"] };
      else if (parsed.status === "PENDING") where.status = { in: ["PO_CREATED", "PENDING_ACCEPTANCE", "ACCEPTED"] };
      else if (parsed.status === "DELIVERED") where.status = { in: ["DELIVERED", "COMPLETED"] };
      else if (parsed.status === "CANCELLED") where.status = "CANCELLED";
      else if (parsed.status === "DISPATCHED") where.status = "DISPATCHED";
      else where.status = parsed.status;
    }
    if (parsed.paymentStatus && parsed.paymentStatus !== "ALL") {
      where.paymentTransactions = { some: { status: parsed.paymentStatus } };
    }
    if (parsed.dateRange !== "ALL") {
      const days = parsed.dateRange === "7D" ? 7 : parsed.dateRange === "30D" ? 30 : 90;
      where.createdAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    const baseInclude = {
      buyer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      items: true,
      milestones: true,
      samples: { orderBy: { createdAt: "desc" as const } },
      qcReports: { orderBy: { submittedAt: "desc" as const } },
      paymentPlan: { include: { milestones: { orderBy: { sequence: "asc" as const } } } },
      paymentTransactions: { select: { id: true, amount: true, currency: true, status: true, createdAt: true } }
    };
    const [items, total, totalOrders, pending, sample, production, qc, dispatched, delivered, cancelled] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, include: baseInclude, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: { in: ["PO_CREATED", "PENDING_ACCEPTANCE", "ACCEPTED"] } } }),
      prisma.purchaseOrder.count({ where: { samples: { some: {} } } }),
      prisma.purchaseOrder.count({ where: { status: { in: ["PRODUCTION_STARTED", "IN_PRODUCTION"] } } }),
      prisma.purchaseOrder.count({ where: { status: { in: ["QC_PENDING", "QC"] } } }),
      prisma.purchaseOrder.count({ where: { status: "DISPATCHED" } }),
      prisma.purchaseOrder.count({ where: { status: { in: ["DELIVERED", "COMPLETED"] } } }),
      prisma.purchaseOrder.count({ where: { status: "CANCELLED" } })
    ]);
    return sendOk(res, {
      items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit),
      stats: { total: totalOrders, pending, sample, production, qc, dispatched, delivered, cancelled }
    });
  } catch (error) { next(error); }
}

export async function adminOrderDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: String(req.params.orderId) },
      include: {
        buyer: { select: { id: true, name: true, city: true, country: true } },
        supplier: { select: { id: true, name: true, city: true, country: true } },
        items: true,
        milestones: true,
        samples: { orderBy: { createdAt: "desc" } },
        qcReports: { orderBy: { submittedAt: "desc" } },
        paymentPlan: { include: { milestones: { orderBy: { sequence: "asc" } } } },
        paymentTransactions: { include: { refunds: true }, orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!order) throw new AppError(404, "Purchase order not found");
    return sendOk(res, order);
  } catch (error) { next(error); }
}

export async function adminPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.extend({
      type: z.enum(["ALL", "COLLECTIONS", "MILESTONES", "PAYOUTS", "REFUNDS", "FAILED"]).default("ALL"),
      dateRange: z.enum(["ALL", "7D", "30D", "90D"]).default("ALL")
    }).parse(req.query);
    const where: any = {};
    if (parsed.q) {
      where.OR = [
        { providerRef: { contains: parsed.q } },
        { razorpayPaymentId: { contains: parsed.q } },
        { razorpayOrderId: { contains: parsed.q } },
        { purchaseOrder: { poNumber: { contains: parsed.q } } },
        { purchaseOrder: { buyer: { name: { contains: parsed.q } } } },
        { purchaseOrder: { supplier: { name: { contains: parsed.q } } } }
      ];
    }
    if (parsed.status && parsed.status !== "ALL") where.status = parsed.status;
    if (parsed.type === "COLLECTIONS") {
      where.AND = [
        { provider: { in: ["RAZORPAY", "MOCK_TEST"] } },
        { OR: [{ signatureVerified: true }, { provider: "MOCK_TEST" }] }
      ];
      where.status = parsed.status && parsed.status !== "ALL" ? parsed.status : "PAID";
    }
    if (parsed.type === "MILESTONES") where.paymentMilestoneId = { not: null };
    if (parsed.type === "PAYOUTS") where.transferId = { not: null };
    if (parsed.type === "REFUNDS") where.refunds = { some: {} };
    if (parsed.type === "FAILED") where.status = "FAILED";
    if (parsed.dateRange !== "ALL") {
      const days = parsed.dateRange === "7D" ? 7 : parsed.dateRange === "30D" ? 30 : 90;
      where.createdAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const [items, total, paid, pending, failed, refunded, payoutRefs] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        include: {
          paymentMilestone: true,
          purchaseOrder: { select: { id: true, poNumber: true, currency: true, totalAmount: true, buyer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } },
          refunds: { orderBy: { createdAt: "desc" } }
        },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.paymentTransaction.count({ where }),
      prisma.paymentTransaction.aggregate({ where: { provider: { in: ["RAZORPAY", "MOCK_TEST"] }, status: "PAID", OR: [{ signatureVerified: true }, { provider: "MOCK_TEST" }] }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.aggregate({ where: { provider: { in: ["RAZORPAY", "MOCK_TEST"] }, status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.aggregate({ where: { provider: { in: ["RAZORPAY", "MOCK_TEST"] }, status: "FAILED" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.paymentRefund.aggregate({ where: { status: { in: ["REQUESTED", "PROCESSING", "PROCESSED"] } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.count({ where: { transferId: { not: null } } })
    ]);
    return sendOk(res, {
      items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit),
      stats: {
        verifiedCollections: Number(paid._sum.amount || 0), verifiedCollectionCount: paid._count._all,
        pendingAmount: Number(pending._sum.amount || 0), pendingCount: pending._count._all,
        failedAmount: Number(failed._sum.amount || 0), failedCount: failed._count._all,
        refundAmount: Number(refunded._sum.amount || 0), refundCount: refunded._count._all,
        supplierTransferRefs: payoutRefs
      }
    });
  } catch (error) { next(error); }
}

export async function adminSupplierPaymentSetups(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.supplierPaymentProfile.findMany({
      select: {
        id: true,
        organizationId: true,
        status: true,
        kycStatus: true,
        settlementStatus: true,
        accountHolderName: true,
        bankName: true,
        bankAccountLast4: true,
        ifscMasked: true,
        rejectionReason: true,
        submittedAt: true,
        verifiedAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, legalName: true, country: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 200
    });
    return sendOk(res, { items });
  } catch (e) { next(e); }
}

export async function adminReviewSupplierPaymentSetup(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      decision: z.enum(["APPROVE", "REJECT"]),
      reason: z.string().trim().max(2000).optional()
    }).parse(req.body);
    if (input.decision === "REJECT" && !input.reason) {
      throw new AppError(400, "A rejection reason is required.");
    }

    const profileId = String(req.params.profileId);
    const profile = await prisma.supplierPaymentProfile.findUnique({
      where: { id: profileId },
      include: { organization: { select: { id: true, name: true } } }
    });
    if (!profile) throw new AppError(404, "Supplier payment setup not found.");
    if (profile.status !== "PENDING") {
      throw new AppError(409, "Only a newly submitted supplier payment setup can be reviewed.");
    }

    const updated = await prisma.$transaction(async tx => {
      const reviewResult = await tx.supplierPaymentProfile.updateMany({
        where: { id: profile.id, status: "PENDING" },
        data: input.decision === "APPROVE"
          ? { status: "VERIFIED", settlementStatus: "PENDING_PROVIDER_SETUP", rejectionReason: null, verifiedAt: new Date() }
          : { status: "REJECTED", settlementStatus: "NOT_STARTED", rejectionReason: input.reason, verifiedAt: null }
      });
      if (reviewResult.count !== 1) throw new AppError(409, "This supplier payment setup was already reviewed.");
      const reviewed = await tx.supplierPaymentProfile.findUniqueOrThrow({ where: { id: profile.id } });
      await tx.auditLog.create({
        data: {
          action: input.decision === "APPROVE" ? "ADMIN_SUPPLIER_PAYMENT_SETUP_APPROVED" : "ADMIN_SUPPLIER_PAYMENT_SETUP_REJECTED",
          entityType: "SupplierPaymentProfile",
          entityId: profile.id,
          actorUserId: req.auth!.userId,
          organizationId: profile.organizationId,
          metadata: { decision: input.decision, reason: input.reason || null }
        }
      });
      return reviewed;
    });

    emitToOrg(profile.organizationId, "payment:setup_updated", { organizationId: profile.organizationId, status: updated.status });
    emitToRole("ADMIN", "payment:setup_updated", { organizationId: profile.organizationId, status: updated.status });

    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function adminDisputes(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [{ reason: { contains: parsed.q } }, { id: { contains: parsed.q } }];
    if (parsed.status && parsed.status !== "ALL") where.status = parsed.status;
    const [items, total] = await Promise.all([
      prisma.dispute.findMany({ where, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.dispute.count({ where })
    ]);
    const orderIds = [...new Set(items.map(item => item.purchaseOrderId))];
    const userIds = [...new Set(items.map(item => item.raisedByUserId))];
    const [orders, users] = await Promise.all([
      prisma.purchaseOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, poNumber: true, buyer: { select: { name: true } }, supplier: { select: { name: true } } } }),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } })
    ]);
    const orderMap = new Map(orders.map(order => [order.id, order]));
    const userMap = new Map(users.map(user => [user.id, user]));
    return sendOk(res, { items: items.map(item => ({ ...item, order: orderMap.get(item.purchaseOrderId) || null, raisedBy: userMap.get(item.raisedByUserId) || null })), page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
  } catch (error) { next(error); }
}
