import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";

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
        supplierProfile: { include: { categories: true, catalogItems: true } },
        _count: { select: { rfqs: true, buyerOrders: true, supplierOrders: true } }
      }
    });
    if (!organization) throw new AppError(404, "Business profile not found");
    return sendOk(res, organization);
  } catch (error) { next(error); }
}

export async function adminUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.extend({ role: z.enum(["ALL", "BUYER", "SUPPLIER", "ADMIN"]).default("ALL"), active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL") }).parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [
      { fullName: { contains: parsed.q } }, { email: { contains: parsed.q } }, { phone: { contains: parsed.q } },
      { memberships: { some: { organization: { name: { contains: parsed.q } } } } }
    ];
    if (parsed.role !== "ALL") where.memberships = { some: { role: parsed.role, isActive: true } };
    if (parsed.active !== "ALL") where.isActive = parsed.active === "ACTIVE";
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, include: { memberships: { include: { organization: { select: { id: true, name: true, verificationStatus: true } } } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
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
      prisma.catalogItem.findMany({ where, include: { supplierProfile: { include: { organization: { select: { id: true, name: true, city: true, verificationStatus: true } } } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
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
    const item = await prisma.catalogItem.update({ where: { id: itemId }, data: { moderationStatus: input.status, moderationNote: input.note || null } });
    await audit("ADMIN_CATALOG_MODERATION", "CatalogItem", item.id, req.auth!.userId, undefined, { status: input.status, note: input.note });
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
      if (parsed.status === "SAMPLE") where.status = { in: ["SAMPLE_PENDING", "SAMPLE_APPROVED"] };
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
      paymentPlan: { include: { milestones: { orderBy: { sequence: "asc" as const } } } },
      paymentTransactions: { select: { id: true, amount: true, currency: true, status: true, createdAt: true } }
    };
    const [items, total, totalOrders, pending, sample, production, qc, dispatched, delivered, cancelled] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, include: baseInclude, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: { in: ["PO_CREATED", "PENDING_ACCEPTANCE", "ACCEPTED"] } } }),
      prisma.purchaseOrder.count({ where: { status: { in: ["SAMPLE_PENDING", "SAMPLE_APPROVED"] } } }),
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
      type: z.enum(["ALL", "COLLECTIONS", "MILESTONES", "PAYOUTS", "FAILED"]).default("ALL"),
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
      where.provider = "RAZORPAY";
      where.signatureVerified = true;
      where.status = parsed.status && parsed.status !== "ALL" ? parsed.status : "PAID";
    }
    if (parsed.type === "MILESTONES") where.paymentMilestoneId = { not: null };
    if (parsed.type === "PAYOUTS") where.transferId = { not: null };
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
      prisma.paymentTransaction.aggregate({ where: { provider: "RAZORPAY", status: "PAID", signatureVerified: true }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.aggregate({ where: { provider: "RAZORPAY", status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.aggregate({ where: { provider: "RAZORPAY", status: "FAILED" }, _sum: { amount: true }, _count: { _all: true } }),
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
      include: { organization: { select: { id: true, name: true, legalName: true, taxId: true, country: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200
    });
    return sendOk(res, { items });
  } catch (e) { next(e); }
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
