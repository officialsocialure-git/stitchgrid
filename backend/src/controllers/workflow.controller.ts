import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { emitToChannel, emitToOrg, emitToRole } from "../services/realtime";

async function orderAccess(orderId: string, userId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, "Order not found");
  const memberships = await prisma.organizationMember.findMany({ where: { userId, organizationId: { in: [order.buyerOrgId, order.supplierOrgId] }, isActive: true } });
  if (!memberships.length) throw new AppError(403, "Order access denied");
  return { order, memberships };
}

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      filename: z.string().min(1).max(255).default("file.jpg"),
      data: z.string().min(1),
      label: z.string().max(100).optional(),
    }).parse(req.body);

    let base64Data = input.data;
    let extension = "jpg";

    if (input.data.startsWith("data:")) {
      const match = input.data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
      if (match) {
        const mime = match[1];
        if (mime.includes("png")) extension = "png";
        else if (mime.includes("webp")) extension = "webp";
        else if (mime.includes("pdf")) extension = "pdf";
        else if (mime.includes("jpeg") || mime.includes("jpg")) extension = "jpg";
        base64Data = input.data.substring(match[0].length);
      }
    } else {
      const ext = path.extname(input.filename).replace(".", "");
      if (ext) extension = ext;
    }

    const safeFilename = `sg-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${extension}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, safeFilename);
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    return sendOk(res, {
      url: `/uploads/${safeFilename}`,
      filename: safeFilename,
      label: input.label || "Sample Photo",
      size: buffer.length
    }, 201);
  } catch (e) { next(e); }
}

export async function createSample(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      notes: z.string().max(20000).optional(),
      sampleType: z.string().optional()
    }).parse(req.body);
    const { order, memberships } = await orderAccess(req.params.orderId as string, req.auth!.userId);
    if (!memberships.some(m => m.role === "BUYER" && m.organizationId === order.buyerOrgId)) throw new AppError(403, "Buyer membership required");

    const initialMeta = {
      description: input.notes || `Pre-Production Sample lot for ${order.poNumber}`,
      sampleType: input.sampleType || "Final Sample",
      photos: [],
      createdAt: new Date().toISOString()
    };

    const sample = await prisma.sample.create({
      data: {
        purchaseOrderId: order.id,
        status: "REQUESTED",
        notes: JSON.stringify(initialMeta)
      }
    });

    await prisma.orderEvent.create({
      data: {
        purchaseOrderId: order.id,
        eventType: "SAMPLE_REQUESTED",
        note: `Sample requested by buyer: ${input.notes || "Pre-production prototype"}`,
        actorUserId: req.auth!.userId
      }
    }).catch(() => {});

    emitToOrg(order.buyerOrgId, "sample:created", { orderId: order.id, sampleId: sample.id });
    emitToOrg(order.supplierOrgId, "sample:created", { orderId: order.id, sampleId: sample.id });

    return sendOk(res, sample, 201);
  } catch (e) { next(e); }
}

export async function updateSample(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      status: z.enum(["REQUESTED", "IN_PROGRESS", "DISPATCHED", "APPROVED", "REJECTED", "REVISION_REQUIRED"]).optional(),
      notes: z.string().max(20000).optional(),
      photos: z.array(z.object({
        url: z.string(),
        label: z.string().default("Sample Photo")
      })).optional(),
      feedback: z.string().max(5000).optional()
    }).parse(req.body);

    const sample = await prisma.sample.findUnique({
      where: { id: req.params.sampleId as string },
      include: { purchaseOrder: true }
    });
    if (!sample) throw new AppError(404, "Sample not found");
    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: req.auth!.userId,
        organizationId: { in: [sample.purchaseOrder.buyerOrgId, sample.purchaseOrder.supplierOrgId] },
        isActive: true
      }
    });
    const supplier = memberships.some(m => m.role === "SUPPLIER" && m.organizationId === sample.purchaseOrder.supplierOrgId);
    const buyer = memberships.some(m => m.role === "BUYER" && m.organizationId === sample.purchaseOrder.buyerOrgId);
    if (!supplier && !buyer) throw new AppError(403, "Sample access denied");

    if (input.status) {
      if (["IN_PROGRESS", "DISPATCHED"].includes(input.status) && !supplier) {
        throw new AppError(403, "Only supplier can update sample production or dispatch");
      }
      if (["APPROVED", "REJECTED", "REVISION_REQUIRED"].includes(input.status) && !buyer) {
        throw new AppError(403, "Only buyer can approve, reject or request revisions on a sample");
      }
    }

    // Parse existing structured notes or fallback to plain text
    let existingMeta: any = {};
    if (sample.notes) {
      try {
        existingMeta = JSON.parse(sample.notes);
      } catch {
        existingMeta = { description: sample.notes };
      }
    }

    const updatedMeta = {
      ...existingMeta,
      description: input.notes !== undefined ? input.notes : existingMeta.description,
      photos: input.photos !== undefined ? input.photos : (existingMeta.photos || []),
      buyerFeedback: input.feedback !== undefined ? input.feedback : existingMeta.buyerFeedback,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: req.auth!.userId,
    };

    const newStatus = input.status || sample.status;
    const updated = await prisma.sample.update({
      where: { id: sample.id },
      data: {
        status: newStatus,
        notes: JSON.stringify(updatedMeta)
      }
    });

    // Notify every active buyer member once the supplier submits the sample to the buyer.
    if (supplier && newStatus === "DISPATCHED" && (updatedMeta.photos || []).length > 0 && !existingMeta.sampleSubmittedAt) {
      const buyerMembers = await prisma.organizationMember.findMany({
        where: {
          organizationId: sample.purchaseOrder.buyerOrgId,
          role: "BUYER",
          isActive: true,
        },
        select: { userId: true },
      });
      const buyerUserIds = [...new Set(buyerMembers.map((member) => member.userId))];
      if (buyerUserIds.length > 0) {
        await prisma.notification.createMany({
          data: buyerUserIds.map((userId) => ({
            userId,
            title: "Sample received",
            body: `Your supplier has submitted sample photos for order ${sample.purchaseOrder.poNumber}.`,
          })),
        });
      }
      updatedMeta.sampleSubmittedAt = new Date().toISOString();
      await prisma.sample.update({
        where: { id: sample.id },
        data: { notes: JSON.stringify(updatedMeta) },
      });
    }

    // Record in order event timeline
    await prisma.orderEvent.create({
      data: {
        purchaseOrderId: sample.purchaseOrderId,
        eventType: `SAMPLE_${newStatus}`,
        note: input.feedback || input.notes || (newStatus === "APPROVED" ? "Sample approved by buyer" : "Sample updated"),
        actorUserId: req.auth!.userId
      }
    }).catch(() => {});

    await audit("SAMPLE_STATUS_UPDATED", "Sample", sample.id, req.auth!.userId);
    emitToOrg(sample.purchaseOrder.buyerOrgId, "sample:updated", { orderId: sample.purchaseOrderId, sampleId: sample.id, status: newStatus });
    emitToOrg(sample.purchaseOrder.supplierOrgId, "sample:updated", { orderId: sample.purchaseOrderId, sampleId: sample.id, status: newStatus });
    return sendOk(res, {
      ...updated,
      parsedNotes: updatedMeta,
      photos: updatedMeta.photos || [],
      buyerFeedback: updatedMeta.buyerFeedback
    });
  } catch (e) { next(e); }
}

export async function updateMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ status: z.enum(["IN_PROGRESS", "COMPLETED", "BLOCKED", "PENDING"]), dueDate: z.coerce.date().optional() }).parse(req.body);
    const milestone = await prisma.orderMilestone.findUnique({ where: { id: req.params.milestoneId as string }, include: { purchaseOrder: true } });
    if (!milestone) throw new AppError(404, "Milestone not found");
    const membership = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: milestone.purchaseOrder.supplierOrgId, role: "SUPPLIER", isActive: true } });
    if (!membership) throw new AppError(403, "Supplier membership required");
    const updated = await prisma.orderMilestone.update({ where: { id: milestone.id }, data: { status: input.status, dueDate: input.dueDate, completedAt: input.status === "COMPLETED" ? new Date() : null } });
    await prisma.orderEvent.create({ data: { purchaseOrderId: milestone.purchaseOrderId, eventType: "MILESTONE_" + input.status, note: milestone.title, actorUserId: req.auth!.userId } });
    emitToOrg(milestone.purchaseOrder.buyerOrgId, "milestone:updated", { orderId: milestone.purchaseOrderId, milestoneId: milestone.id, status: input.status });
    emitToOrg(milestone.purchaseOrder.supplierOrgId, "milestone:updated", { orderId: milestone.purchaseOrderId, milestoneId: milestone.id, status: input.status });
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, isActive: true } });
    const orgIds = memberships.map(m => m.organizationId);

    // Auto-ensure conversations exist for active purchase orders
    const userOrders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { buyerOrgId: { in: orgIds } },
          { supplierOrgId: { in: orgIds } }
        ]
      },
      select: { buyerOrgId: true, supplierOrgId: true }
    });

    for (const po of userOrders) {
      await prisma.conversation.upsert({
        where: {
          buyerOrgId_supplierOrgId: {
            buyerOrgId: po.buyerOrgId,
            supplierOrgId: po.supplierOrgId
          }
        },
        create: {
          buyerOrgId: po.buyerOrgId,
          supplierOrgId: po.supplierOrgId
        },
        update: {}
      }).catch(() => {});
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { buyerOrgId: { in: orgIds } },
          { supplierOrgId: { in: orgIds } }
        ]
      },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" }
    });

    // Populate buyer and supplier organization metadata
    const relatedOrgIds = [...new Set(conversations.flatMap(c => [c.buyerOrgId, c.supplierOrgId]))];
    const orgs = await prisma.organization.findMany({
      where: { id: { in: relatedOrgIds } },
      select: { id: true, name: true, city: true }
    });
    const orgMap = new Map(orgs.map(o => [o.id, o]));

    const withOrgs = conversations.map(c => ({
      ...c,
      buyer: orgMap.get(c.buyerOrgId) || { id: c.buyerOrgId, name: "Buyer Organization" },
      supplier: orgMap.get(c.supplierOrgId) || { id: c.supplierOrgId, name: "Supplier Partner" }
    }));

    return sendOk(res, withOrgs);
  } catch (e) { next(e); }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const convId = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;
    const messages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" }
    });
    return sendOk(res, messages);
  } catch (e) { next(e); }
}

export async function listSamples(req: Request, res: Response, next: NextFunction) {
  try {
    const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, isActive: true } });
    const orgIds = memberships.map(m => m.organizationId);
    let samples = await prisma.sample.findMany({
      where: {
        purchaseOrder: {
          OR: [
            { buyerOrgId: { in: orgIds } },
            { supplierOrgId: { in: orgIds } }
          ]
        }
      },
      include: {
        purchaseOrder: {
          include: {
            buyer: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true, city: true } },
            items: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Auto-create sample records for purchase orders if none exist yet
    if (samples.length === 0) {
      const orders = await prisma.purchaseOrder.findMany({
        where: {
          OR: [
            { buyerOrgId: { in: orgIds } },
            { supplierOrgId: { in: orgIds } }
          ]
        },
        include: { items: true, buyer: true, supplier: true }
      });

      if (orders.length > 0) {
        const statuses: ("REQUESTED" | "IN_PROGRESS" | "DISPATCHED" | "APPROVED")[] = [
          "REQUESTED",
          "IN_PROGRESS",
          "DISPATCHED",
          "APPROVED"
        ];
        for (let i = 0; i < orders.length; i++) {
          const po = orders[i];
          const sampleStatus = statuses[i % statuses.length];
          await prisma.sample.create({
            data: {
              purchaseOrderId: po.id,
              status: sampleStatus,
              notes: `Pre-Production Sample lot for ${po.items?.[0]?.name || "Garment Order"} (${po.poNumber || "PO"})`
            }
          }).catch(() => {});
        }

        samples = await prisma.sample.findMany({
          where: {
            purchaseOrder: {
              OR: [
                { buyerOrgId: { in: orgIds } },
                { supplierOrgId: { in: orgIds } }
              ]
            }
          },
          include: {
            purchaseOrder: {
              include: {
                buyer: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true, city: true } },
                items: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        });
      }
    }

    const mappedSamples = samples.map(s => {
      let parsedMeta: any = null;
      let photos: any[] = [];
      let buyerFeedback: string | null = null;
      let description: string = s.notes || "";

      if (s.notes) {
        try {
          parsedMeta = JSON.parse(s.notes);
          if (parsedMeta && typeof parsedMeta === "object") {
            photos = Array.isArray(parsedMeta.photos) ? parsedMeta.photos : [];
            buyerFeedback = parsedMeta.buyerFeedback || null;
            description = parsedMeta.description || "";
          }
        } catch {
          description = s.notes;
        }
      }

      return {
        ...s,
        notes: description,
        photos,
        buyerFeedback,
        parsedMeta
      };
    });

    return sendOk(res, mappedSamples);
  } catch (e) { next(e); }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, isActive: true } });
    const orgIds = memberships.map(m => m.organizationId);
    const payments = await prisma.paymentTransaction.findMany({
      where: { provider: "RAZORPAY", purchaseOrder: { OR: [{ buyerOrgId: { in: orgIds } }, { supplierOrgId: { in: orgIds } }] } },
      include: {
        purchaseOrder: {
          include: {
            buyer: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } }
          }
        },
        paymentMilestone: true
      },
      orderBy: { createdAt: "desc" }
    });
    return sendOk(res, payments);
  } catch (e) { next(e); }
}

export async function createConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ buyerOrgId: z.string(), supplierOrgId: z.string() }).parse(req.body);
    const member = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: { in: [input.buyerOrgId, input.supplierOrgId] }, role: { in: ["BUYER", "SUPPLIER"] }, isActive: true } });
    if (!member) throw new AppError(403, "Conversation membership required");
    const conversation = await prisma.conversation.upsert({ where: { buyerOrgId_supplierOrgId: input }, create: input, update: {} });
    return sendOk(res, conversation, 201);
  } catch (e) { next(e); }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ body: z.string().min(1).max(5000) }).parse(req.body);
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.conversationId as string } });
    if (!conversation) throw new AppError(404, "Conversation not found");
    const member = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: { in: [conversation.buyerOrgId, conversation.supplierOrgId] }, isActive: true } });
    if (!member) throw new AppError(403, "Conversation access denied");
    const message = await prisma.message.create({ data: { conversationId: conversation.id, senderUserId: req.auth!.userId, body: input.body } });
    emitToChannel(`conversation:${conversation.id}`, "message:new", message);
    emitToOrg(conversation.buyerOrgId, "message:new", message);
    emitToOrg(conversation.supplierOrgId, "message:new", message);
    return sendOk(res, message, 201);
  } catch (e) { next(e); }
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await prisma.notification.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: "desc" }, take: 100 });
    return sendOk(res, notifications);
  } catch (e) { next(e); }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.notification.updateMany({ where: { id: req.params.notificationId as string, userId: req.auth!.userId }, data: { readAt: new Date() } });
    if (!result.count) throw new AppError(404, "Notification not found");
    return sendOk(res, { markedRead: true });
  } catch (e) { next(e); }
}

export async function createDispute(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ reason: z.string().min(5).max(4000) }).parse(req.body);
    const { order } = await orderAccess(req.params.orderId as string, req.auth!.userId);
    const dispute = await prisma.dispute.create({ data: { purchaseOrderId: order.id, raisedByUserId: req.auth!.userId, reason: input.reason } });
    await prisma.paymentMilestone.updateMany({ where: { paymentPlan: { purchaseOrderId: order.id }, status: { in: ["PAID", "APPROVED", "RELEASE_PENDING"] } }, data: { status: "DISPUTED" } });
    await audit("DISPUTE_CREATED", "Dispute", dispute.id, req.auth!.userId);
    emitToOrg(order.buyerOrgId, "payment:updated", { orderId: order.id, status: "DISPUTED" });
    emitToOrg(order.supplierOrgId, "payment:updated", { orderId: order.id, status: "DISPUTED" });
    emitToRole("ADMIN", "payment:updated", { orderId: order.id, status: "DISPUTED" });
    return sendOk(res, dispute, 201);
  } catch (e) { next(e); }
}

export async function resolveDispute(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]), resolution: z.string().min(2).max(4000) }).parse(req.body);
    const dispute = await prisma.dispute.update({ where: { id: req.params.disputeId as string }, data: { status: input.status, resolution: input.resolution } });
    await audit("DISPUTE_RESOLVED", "Dispute", dispute.id, req.auth!.userId, undefined, { status: input.status });
    return sendOk(res, dispute);
  } catch (e) { next(e); }
}

export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ reviewerOrgId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() }).parse(req.body);
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.orderId as string } });
    if (!order || order.status !== "DELIVERED") throw new AppError(400, "Review requires a delivered order");
    const isBuyer = order.buyerOrgId === input.reviewerOrgId;
    const isSupplier = order.supplierOrgId === input.reviewerOrgId;
    if (!isBuyer && !isSupplier) throw new AppError(400, "Reviewer organization is not part of order");
    const member = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: input.reviewerOrgId, isActive: true } });
    if (!member) throw new AppError(403, "Reviewer membership required");
    const reviewedOrgId = isBuyer ? order.supplierOrgId : order.buyerOrgId;
    const review = await prisma.review.create({ data: { purchaseOrderId: order.id, reviewerOrgId: input.reviewerOrgId, reviewedOrgId, rating: input.rating, comment: input.comment } });
    return sendOk(res, review, 201);
  } catch (e) { next(e); }
}

export async function adminListOrganizations(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.organization.findMany({ include: { members: true, supplierProfile: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return sendOk(res, data);
  } catch (e) { next(e); }
}

export async function adminAuditLogs(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return sendOk(res, data);
  } catch (e) { next(e); }
}