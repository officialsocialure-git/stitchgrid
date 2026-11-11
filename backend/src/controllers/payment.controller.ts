import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { emitToOrg, emitToRole } from "../services/realtime";
import { createRazorpayOrder, createRazorpayRefund, fetchRazorpayPayment, getRazorpayPublicKey, isRazorpayConfigured, verifyCheckoutSignature, verifyWebhookSignature } from "../services/razorpay";

const DEFAULT_PLAN = [
  { title: "Order Confirmation", sequence: 1, percentage: 20 },
  { title: "Sample Approval", sequence: 2, percentage: 20 },
  { title: "Production Completion", sequence: 3, percentage: 40 },
  { title: "QC & Dispatch", sequence: 4, percentage: 20 }
];

async function orderMembership(orderId: string, userId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, "Order not found");
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId: { in: [order.buyerOrgId, order.supplierOrgId] }, isActive: true }
  });
  if (!membership) throw new AppError(403, "Order access denied");
  return { order, membership };
}

async function ensurePaymentPlan(orderId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId }, include: { paymentPlan: { include: { milestones: { orderBy: { sequence: "asc" } } } } } });
  if (!order) throw new AppError(404, "Order not found");
  if (order.paymentPlan) return order.paymentPlan;
  const total = Number(order.totalAmount);
  return prisma.paymentPlan.create({
    data: {
      purchaseOrderId: order.id,
      totalAmount: order.totalAmount,
      currency: order.currency,
      milestones: {
        create: DEFAULT_PLAN.map((item, index) => ({
          ...item,
          amount: index === DEFAULT_PLAN.length - 1
            ? total - DEFAULT_PLAN.slice(0, -1).reduce((sum, part) => sum + total * part.percentage / 100, 0)
            : total * item.percentage / 100,
          status: index === 0 ? ("DUE" as const) : ("UPCOMING" as const)
        }))
      },
    },
    include: { milestones: { orderBy: { sequence: "asc" } } }
  });
}

export async function paymentDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, isActive: true } });
    const orgIds = memberships.map(m => m.organizationId);
    const activeRole = req.auth!.role;
    const supplierOrgIds = memberships.filter(m => m.role === "SUPPLIER").map(m => m.organizationId);
    const profile = activeRole === "SUPPLIER" && supplierOrgIds.length
      ? await prisma.supplierPaymentProfile.findUnique({ where: { organizationId: req.auth!.organizationId || supplierOrgIds[0] } })
      : null;
    const orders = await prisma.purchaseOrder.findMany({
      where: { OR: [{ buyerOrgId: { in: orgIds } }, { supplierOrgId: { in: orgIds } }] },
      include: {
        buyer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        paymentPlan: { include: { milestones: { orderBy: { sequence: "asc" } } } },
        paymentTransactions: { where: { provider: "RAZORPAY" }, include: { refunds: true }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { createdAt: "desc" }
    });
    return sendOk(res, {
      provider: "RAZORPAY",
      checkoutConfigured: isRazorpayConfigured(),
      razorpayKeyId: getRazorpayPublicKey(),
      supplierSetup: profile || { status: "NOT_STARTED", kycStatus: "NOT_STARTED", settlementStatus: "NOT_STARTED" },
      orders
    });
  } catch (e) { next(e); }
}

export async function getOrCreatePaymentPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { order, membership } = await orderMembership(String(req.params.orderId), req.auth!.userId);
    if (membership.role !== "BUYER" || membership.organizationId !== order.buyerOrgId) throw new AppError(403, "Only the buyer can set the payment plan.");
    const plan = await ensurePaymentPlan(order.id);
    return sendOk(res, plan);
  } catch (e) { next(e); }
}

export async function createMilestoneCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const milestoneId = String(req.params.milestoneId);
    const milestone = await prisma.paymentMilestone.findUnique({
      where: { id: milestoneId },
      include: { paymentPlan: { include: { purchaseOrder: true } }, transactions: true }
    });
    if (!milestone) throw new AppError(404, "Payment milestone not found");
    const order = milestone.paymentPlan.purchaseOrder;
    const buyerMembership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: order.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!buyerMembership) throw new AppError(403, "Only the buyer can pay this milestone.");
    if (["PENDING_ACCEPTANCE", "PO_CREATED", "CANCELLED"].includes(order.status)) throw new AppError(409, "The supplier must accept the purchase order before payment can begin.");
    if (order.currency !== "INR") throw new AppError(400, "Razorpay Checkout is currently configured for INR orders only.");
    const resumable = milestone.transactions.find(t => t.status === "PENDING" && t.razorpayOrderId);
    if (resumable && milestone.status === "PAYMENT_PENDING") {
      return sendOk(res, { paymentId: resumable.id, razorpayOrderId: resumable.razorpayOrderId, amount: Math.round(Number(resumable.amount) * 100), currency: resumable.currency, keyId: getRazorpayPublicKey(), name: "STITCHGRID", description: `${milestone.title} - ${order.poNumber}`, prefill: {} });
    }
    if (!["DUE", "APPROVED", "FAILED"].includes(milestone.status)) throw new AppError(409, "This milestone is not currently due for payment.");
    if (milestone.transactions.some(t => ["CREATING", "CREATED", "PENDING", "CAPTURED", "PAID"].includes(t.status))) {
      throw new AppError(409, "A payment attempt already exists for this milestone.");
    }
    const amount = Number(milestone.amount);
    const payment = await prisma.paymentTransaction.create({
      data: { purchaseOrderId: order.id, paymentMilestoneId: milestone.id, provider: "RAZORPAY", amount, currency: order.currency, status: "CREATING" }
    });
    try {
      const razorpayOrder = await createRazorpayOrder(amount, payment.id, {
        stitchgridPaymentId: payment.id,
        purchaseOrderId: order.id,
        milestoneId: milestone.id,
        poNumber: order.poNumber
      });
      const updated = await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { razorpayOrderId: razorpayOrder.id, providerRef: razorpayOrder.id, status: "PENDING" }
      });
      await prisma.paymentMilestone.update({ where: { id: milestone.id }, data: { status: "PAYMENT_PENDING" } });
      emitToOrg(order.buyerOrgId, "payment:updated", { orderId: order.id, milestoneId: milestone.id, paymentId: updated.id, status: "PENDING" });
      emitToOrg(order.supplierOrgId, "payment:updated", { orderId: order.id, milestoneId: milestone.id, paymentId: updated.id, status: "PENDING" });
      return sendOk(res, { paymentId: updated.id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId: getRazorpayPublicKey(), name: "STITCHGRID", description: `${milestone.title} - ${order.poNumber}`, prefill: {} }, 201);
    } catch (error) {
      await prisma.paymentTransaction.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await prisma.paymentMilestone.update({ where: { id: milestone.id }, data: { status: milestone.status } });
      throw error;
    }
  } catch (e) { next(e); }
}

export async function verifyMilestonePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1)
    }).parse(req.body);
    const payment = await prisma.paymentTransaction.findUnique({
      where: { razorpayOrderId: input.razorpay_order_id },
      include: { paymentMilestone: true, purchaseOrder: true }
    });
    if (!payment || !payment.paymentMilestone) throw new AppError(404, "Payment attempt not found.");
    const buyerMembership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: payment.purchaseOrder.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!buyerMembership) throw new AppError(403, "Buyer payment verification access denied.");
    const valid = verifyCheckoutSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature);
    if (!valid) throw new AppError(400, "Razorpay payment signature verification failed.", "PAYMENT_SIGNATURE_INVALID");
    if (payment.status === "PAID" && payment.razorpayPaymentId === input.razorpay_payment_id) return sendOk(res, payment);
    const providerPayment = await fetchRazorpayPayment(input.razorpay_payment_id);
    if (providerPayment.order_id !== input.razorpay_order_id || providerPayment.status !== "captured" || providerPayment.amount !== Math.round(Number(payment.amount) * 100) || providerPayment.currency !== payment.currency) {
      throw new AppError(400, "Razorpay payment is not captured for the expected order amount.", "PAYMENT_NOT_CAPTURED");
    }
    const updated = await prisma.$transaction(async tx => {
      const txUpdated = await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: { razorpayPaymentId: input.razorpay_payment_id, signatureVerified: true, status: "PAID", capturedAt: new Date() }
      });
      await tx.paymentMilestone.update({ where: { id: payment.paymentMilestoneId! }, data: { status: "PAID" } });
      const supplierMembers = await tx.organizationMember.findMany({ where: { organizationId: payment.purchaseOrder.supplierOrgId, role: "SUPPLIER", isActive: true }, select: { userId: true } });
      if (supplierMembers.length) await tx.notification.createMany({ data: supplierMembers.map(m => ({ userId: m.userId, title: "Milestone payment received", body: `Buyer payment for ${payment.paymentMilestone!.title} on PO #${payment.purchaseOrder.poNumber} has been verified.` })) });
      return txUpdated;
    });
    await audit("RAZORPAY_PAYMENT_VERIFIED", "PaymentTransaction", updated.id, req.auth!.userId, payment.purchaseOrder.buyerOrgId, { razorpayPaymentId: input.razorpay_payment_id });
    emitToOrg(payment.purchaseOrder.buyerOrgId, "payment:updated", { orderId: payment.purchaseOrderId, milestoneId: payment.paymentMilestoneId, paymentId: payment.id, status: "PAID" });
    emitToOrg(payment.purchaseOrder.supplierOrgId, "payment:updated", { orderId: payment.purchaseOrderId, milestoneId: payment.paymentMilestoneId, paymentId: payment.id, status: "PAID" });
    emitToRole("ADMIN", "payment:updated", { orderId: payment.purchaseOrderId, paymentId: payment.id, status: "PAID" });
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function submitMilestoneProof(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ proofUrl: z.string().min(1).max(2000).refine(value => value.startsWith("/uploads/") || value.startsWith("https://") || value.startsWith("http://"), "A valid uploaded file path or URL is required."), note: z.string().max(4000).optional() }).parse(req.body);
    const milestone = await prisma.paymentMilestone.findUnique({ where: { id: String(req.params.milestoneId) }, include: { paymentPlan: { include: { purchaseOrder: true } } } });
    if (!milestone) throw new AppError(404, "Milestone not found");
    const order = milestone.paymentPlan.purchaseOrder;
    const supplier = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: order.supplierOrgId, role: "SUPPLIER", isActive: true } });
    if (!supplier) throw new AppError(403, "Supplier membership required.");
    if (!["UPCOMING", "REJECTED", "PROOF_SUBMITTED"].includes(milestone.status) || milestone.sequence === 1) throw new AppError(409, "This milestone is not ready for supplier proof.");
    const previousMilestone = await prisma.paymentMilestone.findFirst({ where: { paymentPlanId: milestone.paymentPlanId, sequence: milestone.sequence - 1 } });
    if (!previousMilestone || previousMilestone.status !== "PAID") throw new AppError(409, "The previous payment milestone must be paid before submitting this proof.");
    const updated = await prisma.paymentMilestone.update({ where: { id: milestone.id }, data: { proofUrl: input.proofUrl, completionNote: input.note, submittedAt: new Date(), status: "PROOF_SUBMITTED", rejectionReason: null } });
    emitToOrg(order.buyerOrgId, "payment:updated", { orderId: order.id, milestoneId: milestone.id, status: updated.status });
    emitToOrg(order.supplierOrgId, "payment:updated", { orderId: order.id, milestoneId: milestone.id, status: updated.status });
    emitToRole("ADMIN", "payment:updated", { orderId: order.id, milestoneId: milestone.id, status: updated.status });
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function reviewMilestoneProof(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().max(4000).optional() }).parse(req.body);
    const milestone = await prisma.paymentMilestone.findUnique({ where: { id: String(req.params.milestoneId) }, include: { paymentPlan: { include: { purchaseOrder: true } } } });
    if (!milestone) throw new AppError(404, "Milestone not found");
    const order = milestone.paymentPlan.purchaseOrder;
    const buyer = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: order.buyerOrgId, role: "BUYER", isActive: true } });
    if (!buyer) throw new AppError(403, "Only the buyer can review milestone proof.");
    if (milestone.status !== "PROOF_SUBMITTED") throw new AppError(409, "There is no milestone proof awaiting review.");
    if (input.decision === "REJECT" && !input.reason?.trim()) throw new AppError(400, "Please provide a reason for rejection.");
    const updated = await prisma.paymentMilestone.update({
      where: { id: milestone.id },
      data: input.decision === "APPROVE"
        ? { status: "APPROVED", approvedAt: new Date(), rejectionReason: null }
        : { status: "REJECTED", rejectedAt: new Date(), rejectionReason: input.reason }
    });
    await audit("PAYMENT_MILESTONE_" + input.decision, "PaymentMilestone", milestone.id, req.auth!.userId, order.buyerOrgId, { reason: input.reason });
    emitToOrg(order.buyerOrgId, "payment:updated", { orderId: order.id, milestoneId: milestone.id, status: updated.status });
    emitToOrg(order.supplierOrgId, "payment:updated", { orderId: order.id, milestoneId: milestone.id, status: updated.status });
    emitToRole("ADMIN", "payment:updated", { orderId: order.id, milestoneId: milestone.id, status: updated.status });
    return sendOk(res, { ...updated, settlement: "PENDING_PROVIDER_ROUTE_APPROVAL" });
  } catch (e) { next(e); }
}

export async function updateSupplierPaymentSetup(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      accountHolderName: z.string().min(2).max(150),
      bankName: z.string().min(2).max(120),
      bankAccountLast4: z.string().regex(/^\d{4}$/),
      ifscMasked: z.string().min(4).max(20)
    }).parse(req.body);
    const membership = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, role: "SUPPLIER", isActive: true, ...(req.auth!.organizationId ? { organizationId: req.auth!.organizationId } : {}) } });
    if (!membership) throw new AppError(403, "Active supplier membership required.");
    const profile = await prisma.supplierPaymentProfile.upsert({
      where: { organizationId: membership.organizationId },
      create: { organizationId: membership.organizationId, ...input, status: "PENDING", kycStatus: "PENDING", settlementStatus: "PENDING", submittedAt: new Date() },
      update: { ...input, status: "PENDING", kycStatus: "PENDING", settlementStatus: "PENDING", submittedAt: new Date(), verifiedAt: null, rejectionReason: null }
    });
    await audit("SUPPLIER_PAYMENT_SETUP_SUBMITTED", "SupplierPaymentProfile", profile.id, req.auth!.userId, membership.organizationId);
    emitToOrg(membership.organizationId, "payment:setup_updated", { status: profile.status });
    emitToRole("ADMIN", "payment:setup_updated", { organizationId: membership.organizationId, status: profile.status });
    return sendOk(res, profile, 201);
  } catch (e) { next(e); }
}


export async function requestPaymentRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ reason: z.string().min(5).max(2000) }).parse(req.body);
    const payment = await prisma.paymentTransaction.findUnique({ where: { id: String(req.params.transactionId) }, include: { purchaseOrder: true, refunds: true } });
    if (!payment || payment.provider !== "RAZORPAY") throw new AppError(404, "Verified Razorpay transaction not found.");
    const buyer = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: payment.purchaseOrder.buyerOrgId, role: "BUYER", isActive: true } });
    if (!buyer) throw new AppError(403, "Only the buyer can request a refund.");
    if (payment.status !== "PAID" || !payment.razorpayPaymentId) throw new AppError(409, "Only a verified paid transaction can be refunded.");
    if (payment.refunds.some(r => ["REQUESTED", "PROCESSING", "PROCESSED"].includes(r.status))) throw new AppError(409, "A refund request already exists for this transaction.");
    const refund = await prisma.paymentRefund.create({ data: { paymentTransactionId: payment.id, amount: payment.amount, status: "REQUESTED", reason: input.reason } });
    await audit("PAYMENT_REFUND_REQUESTED", "PaymentRefund", refund.id, req.auth!.userId, payment.purchaseOrder.buyerOrgId, { paymentTransactionId: payment.id });
    emitToRole("ADMIN", "payment:refund_updated", { refundId: refund.id, status: refund.status });
    emitToOrg(payment.purchaseOrder.buyerOrgId, "payment:refund_updated", { refundId: refund.id, status: refund.status });
    return sendOk(res, refund, 201);
  } catch (e) { next(e); }
}

export async function adminListPaymentRefunds(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.paymentRefund.findMany({
      include: { paymentTransaction: { include: { purchaseOrder: { include: { buyer: { select: { name: true } }, supplier: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" }, take: 200
    });
    return sendOk(res, { items });
  } catch (e) { next(e); }
}

export async function adminProcessPaymentRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ decision: z.enum(["APPROVE", "REJECT"]), note: z.string().max(2000).optional() }).parse(req.body);
    const refund = await prisma.paymentRefund.findUnique({ where: { id: String(req.params.refundId) }, include: { paymentTransaction: { include: { purchaseOrder: true, paymentMilestone: true } } } });
    if (!refund) throw new AppError(404, "Refund request not found.");
    if (refund.status !== "REQUESTED") throw new AppError(409, "This refund request has already been processed.");
    if (input.decision === "REJECT") {
      const rejected = await prisma.paymentRefund.update({ where: { id: refund.id }, data: { status: "REJECTED", reason: input.note ? `${refund.reason || ""}\nAdmin: ${input.note}` : refund.reason } });
      await audit("PAYMENT_REFUND_REJECTED", "PaymentRefund", refund.id, req.auth!.userId);
      emitToRole("ADMIN", "payment:refund_updated", { refundId: refund.id, status: rejected.status });
      emitToOrg(refund.paymentTransaction.purchaseOrder.buyerOrgId, "payment:refund_updated", { refundId: refund.id, status: rejected.status });
      return sendOk(res, rejected);
    }
    const transaction = refund.paymentTransaction;
    if (!transaction.razorpayPaymentId || transaction.provider !== "RAZORPAY") throw new AppError(409, "The transaction is not eligible for a Razorpay refund.");
    try {
      const providerRefund = await createRazorpayRefund(transaction.razorpayPaymentId, Number(refund.amount), { stitchgridRefundId: refund.id, purchaseOrderId: transaction.purchaseOrderId });
      const status = providerRefund.status === "processed" ? "PROCESSED" : providerRefund.status === "failed" ? "FAILED" : "PROCESSING";
      const updated = await prisma.$transaction(async tx => {
        const result = await tx.paymentRefund.update({ where: { id: refund.id }, data: { providerRefundId: providerRefund.id, status } });
        if (status === "PROCESSED") {
          await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "REFUNDED" } });
          if (transaction.paymentMilestoneId) await tx.paymentMilestone.update({ where: { id: transaction.paymentMilestoneId }, data: { status: "REFUNDED" } });
        }
        return result;
      });
      await audit("PAYMENT_REFUND_APPROVED", "PaymentRefund", refund.id, req.auth!.userId, undefined, { providerRefundId: providerRefund.id, status });
      emitToRole("ADMIN", "payment:refund_updated", { refundId: refund.id, status });
      emitToOrg(transaction.purchaseOrder.buyerOrgId, "payment:refund_updated", { refundId: refund.id, status });
      emitToOrg(transaction.purchaseOrder.supplierOrgId, "payment:refund_updated", { refundId: refund.id, status });
      return sendOk(res, updated);
    } catch (error) {
      await prisma.paymentRefund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
      throw error;
    }
  } catch (e) { next(e); }
}

export async function razorpayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header("x-razorpay-signature");
    if (!verifyWebhookSignature(rawBody, signature)) throw new AppError(400, "Invalid Razorpay webhook signature.", "WEBHOOK_SIGNATURE_INVALID");
    const eventId = req.header("x-razorpay-event-id");
    if (!eventId) throw new AppError(400, "Missing Razorpay event identifier.");
    const payload = req.body as any;
    const eventType = String(payload?.event || "unknown");
    const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
    if (existing?.processedAt) return sendOk(res, { received: true, duplicate: true });
    if (!existing) await prisma.paymentWebhookEvent.create({ data: { eventId, eventType, signatureValid: true, payload } });
    if (eventType === "payment.captured") {
      const entity = payload?.payload?.payment?.entity;
      const payment = entity?.id ? await prisma.paymentTransaction.findFirst({ where: { razorpayOrderId: entity.order_id }, include: { paymentMilestone: true, purchaseOrder: true } }) : null;
      if (payment && payment.status !== "PAID" && entity.amount === Math.round(Number(payment.amount) * 100) && entity.currency === payment.currency) {
        await prisma.$transaction(async tx => {
          await tx.paymentTransaction.update({ where: { id: payment.id }, data: { razorpayPaymentId: entity.id, status: "PAID", signatureVerified: true, paymentMethod: entity.method || null, capturedAt: new Date((entity.created_at || Math.floor(Date.now() / 1000)) * 1000) } });
          if (payment.paymentMilestone) {
            await tx.paymentMilestone.update({ where: { id: payment.paymentMilestone.id }, data: { status: "PAID" } });
          }
        });
        emitToOrg(payment.purchaseOrder.buyerOrgId, "payment:updated", { orderId: payment.purchaseOrderId, paymentId: payment.id, status: "PAID" });
        emitToOrg(payment.purchaseOrder.supplierOrgId, "payment:updated", { orderId: payment.purchaseOrderId, paymentId: payment.id, status: "PAID" });
        emitToRole("ADMIN", "payment:updated", { orderId: payment.purchaseOrderId, paymentId: payment.id, status: "PAID" });
      }
    } else if (eventType === "payment.failed") {
      const entity = payload?.payload?.payment?.entity;
      const payment = entity?.order_id ? await prisma.paymentTransaction.findFirst({ where: { razorpayOrderId: entity.order_id }, include: { paymentMilestone: true, purchaseOrder: true } }) : null;
      if (payment && payment.status !== "PAID") {
        await prisma.paymentTransaction.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        if (payment.paymentMilestone) await prisma.paymentMilestone.update({ where: { id: payment.paymentMilestone.id }, data: { status: "FAILED" } });
        emitToOrg(payment.purchaseOrder.buyerOrgId, "payment:updated", { orderId: payment.purchaseOrderId, paymentId: payment.id, status: "FAILED" });
        emitToOrg(payment.purchaseOrder.supplierOrgId, "payment:updated", { orderId: payment.purchaseOrderId, paymentId: payment.id, status: "FAILED" });
      }
    } else if (eventType === "refund.processed" || eventType === "refund.failed") {
      const entity = payload?.payload?.refund?.entity;
      const refund = entity?.id ? await prisma.paymentRefund.findUnique({ where: { providerRefundId: entity.id }, include: { paymentTransaction: { include: { purchaseOrder: true } } } }) : null;
      if (refund) {
        const status = eventType === "refund.processed" ? "PROCESSED" : "FAILED";
        await prisma.paymentRefund.update({ where: { id: refund.id }, data: { status } });
        if (status === "PROCESSED") {
          await prisma.paymentTransaction.update({ where: { id: refund.paymentTransactionId }, data: { status: "REFUNDED" } });
          if (refund.paymentTransaction.paymentMilestoneId) await prisma.paymentMilestone.update({ where: { id: refund.paymentTransaction.paymentMilestoneId }, data: { status: "REFUNDED" } });
        }
        emitToOrg(refund.paymentTransaction.purchaseOrder.buyerOrgId, "payment:refund_updated", { refundId: refund.id, status });
        emitToOrg(refund.paymentTransaction.purchaseOrder.supplierOrgId, "payment:refund_updated", { refundId: refund.id, status });
        emitToRole("ADMIN", "payment:refund_updated", { refundId: refund.id, status });
      }
    }
    await prisma.paymentWebhookEvent.update({ where: { eventId }, data: { processedAt: new Date() } });
    return sendOk(res, { received: true });
  } catch (e) { next(e); }
}
