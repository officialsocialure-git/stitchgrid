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
    const parsed = pageQuery.extend({ category: z.string().optional() }).parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [{ name: { contains: parsed.q } }, { description: { contains: parsed.q } }, { supplierProfile: { organization: { name: { contains: parsed.q } } } }];
    if (parsed.category && parsed.category !== "ALL") where.itemType = parsed.category;
    const [items, total] = await Promise.all([
      prisma.catalogItem.findMany({ where, include: { supplierProfile: { include: { organization: { select: { id: true, name: true, city: true, verificationStatus: true } } } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.catalogItem.count({ where })
    ]);
    return sendOk(res, { items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
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
    const parsed = pageQuery.parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [{ title: { contains: parsed.q } }, { id: { contains: parsed.q } }, { buyer: { name: { contains: parsed.q } } }];
    if (parsed.status && parsed.status !== "ALL") where.status = parsed.status;
    const [items, total] = await Promise.all([
      prisma.rfq.findMany({ where, include: { buyer: { select: { id: true, name: true, city: true } }, items: true, quotations: { include: { supplier: { select: { id: true, name: true } } } }, _count: { select: { quotations: true, invitations: true } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.rfq.count({ where })
    ]);
    return sendOk(res, { items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
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
    const parsed = pageQuery.parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [{ poNumber: { contains: parsed.q } }, { buyer: { name: { contains: parsed.q } } }, { supplier: { name: { contains: parsed.q } } }];
    if (parsed.status && parsed.status !== "ALL") where.status = parsed.status;
    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, include: { buyer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } }, items: true, milestones: true, samples: true }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.purchaseOrder.count({ where })
    ]);
    return sendOk(res, { items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
  } catch (error) { next(error); }
}

export async function adminPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = pageQuery.parse(req.query);
    const where: any = {};
    if (parsed.q) where.OR = [{ providerRef: { contains: parsed.q } }, { provider: { contains: parsed.q } }];
    if (parsed.status && parsed.status !== "ALL") where.status = parsed.status;
    const [items, total] = await Promise.all([
      prisma.paymentTransaction.findMany({ where, include: { paymentMilestone: true }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.paymentTransaction.count({ where })
    ]);
    const orderIds = [...new Set(items.map(item => item.purchaseOrderId))];
    const orders = await prisma.purchaseOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, poNumber: true, buyer: { select: { name: true } }, supplier: { select: { name: true } } } });
    const orderMap = new Map(orders.map(order => [order.id, order]));
    return sendOk(res, { items: items.map(item => ({ ...item, order: orderMap.get(item.purchaseOrderId) || null })), page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
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
