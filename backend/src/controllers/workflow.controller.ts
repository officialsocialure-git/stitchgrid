import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { emitToChannel, emitToOrg, emitToRole, emitToUser } from "../services/realtime";

async function orderAccess(orderId: string, userId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, "Order not found");
  const memberships = await prisma.organizationMember.findMany({ where: { userId, organizationId: { in: [order.buyerOrgId, order.supplierOrgId] }, isActive: true } });
  if (!memberships.length) throw new AppError(403, "Order access denied");
  return { order, memberships };
}



const qcChecklistSchema = z.object({
  fabricQuality: z.boolean(),
  stitching: z.boolean(),
  measurements: z.boolean(),
  colorAndFinishing: z.boolean(),
  buttonsZippersAccessories: z.boolean(),
  defectsInspected: z.boolean(),
});

export async function submitQualityCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      totalQuantity: z.number().int().positive(),
      inspectedQuantity: z.number().int().positive(),
      passedQuantity: z.number().int().min(0),
      defectiveQuantity: z.number().int().min(0),
      checklist: qcChecklistSchema,
      photos: z.array(z.string().url()).min(1).max(12),
      defectivePhotos: z.array(z.string().url()).max(8).optional(),
      remarks: z.string().max(3000).optional(),
    }).parse(req.body);
    if (input.inspectedQuantity > input.totalQuantity ||
        input.passedQuantity + input.defectiveQuantity !== input.inspectedQuantity) {
      throw new AppError(400, "Quantity values must be consistent: passed + defective must equal inspected, and inspected cannot exceed total.");
    }
    if (Object.values(input.checklist).some(value => value !== true)) {
      throw new AppError(400, "Please complete every required quality checklist item before submitting.");
    }

    const orderId = String(req.params.orderId);
    const { order, memberships } = await orderAccess(orderId, req.auth!.userId);
    if (!memberships.some(m => m.role === "SUPPLIER" && m.organizationId === order.supplierOrgId)) {
      throw new AppError(403, "Only the supplier assigned to this order can submit its QC report.");
    }
    if (!["PRODUCTION_STARTED", "IN_PRODUCTION", "QC_PENDING", "QC"].includes(order.status)) {
      throw new AppError(409, "The order must be in production before a QC report can be submitted.");
    }

    const report = await prisma.$transaction(async tx => {
      const pendingReport = await tx.qualityCheckReport.findFirst({ where: { purchaseOrderId: order.id, status: "SUBMITTED" } });
      if (pendingReport) throw new AppError(409, "A QC report is already awaiting buyer review for this order.");
      const created = await tx.qualityCheckReport.create({
        data: {
          purchaseOrderId: order.id,
          supplierUserId: req.auth!.userId,
          totalQuantity: input.totalQuantity,
          inspectedQuantity: input.inspectedQuantity,
          passedQuantity: input.passedQuantity,
          defectiveQuantity: input.defectiveQuantity,
          checklist: input.checklist,
          photos: input.photos,
          defectivePhotos: input.defectivePhotos?.length ? input.defectivePhotos : undefined,
          remarks: input.remarks?.trim() || null,
        },
      });
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "QC_PENDING", qcNotes: input.remarks?.trim() || "Supplier submitted a detailed quality inspection report." } });
      await tx.orderEvent.create({ data: { purchaseOrderId: order.id, eventType: "QC_REPORT_SUBMITTED", note: "Supplier submitted QC quantities, completed checklist and inspection photos.", actorUserId: req.auth!.userId } });
      const buyers = await tx.organizationMember.findMany({ where: { organizationId: order.buyerOrgId, role: "BUYER", isActive: true }, select: { userId: true } });
      if (buyers.length) await tx.notification.createMany({ data: buyers.map(b => ({ userId: b.userId, title: "QC report ready for review", body: `Supplier submitted the quality inspection report for PO #${order.poNumber}. Please review the quantities, checklist and photos.` })) });
      return created;
    });

    await audit("QC_REPORT_SUBMITTED", "QualityCheckReport", report.id, req.auth!.userId, order.supplierOrgId, { purchaseOrderId: order.id });
    emitToOrg(order.buyerOrgId, "qc:submitted", { orderId: order.id, reportId: report.id });
    emitToOrg(order.supplierOrgId, "qc:submitted", { orderId: order.id, reportId: report.id });
    emitToRole("ADMIN", "qc:submitted", { orderId: order.id, reportId: report.id });
    return sendOk(res, report, 201);
  } catch (error) { next(error); }
}

export async function reviewQualityCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      decision: z.enum(["APPROVE", "RECHECK"]),
      feedback: z.string().trim().max(3000).optional(),
    }).parse(req.body);
    if (input.decision === "RECHECK" && (!input.feedback || input.feedback.length < 5)) {
      throw new AppError(400, "Please provide at least 5 characters explaining what needs to be corrected.");
    }
    const reportId = String(req.params.reportId);
    const report = await prisma.qualityCheckReport.findUnique({ where: { id: reportId }, include: { purchaseOrder: true } });
    if (!report) throw new AppError(404, "QC report not found.");
    const order = report.purchaseOrder;
    const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, organizationId: order.buyerOrgId, role: "BUYER", isActive: true } });
    const isAdmin = req.auth!.role === "ADMIN";
    if (!memberships.length && !isAdmin) throw new AppError(403, "Only the buyer for this order or an admin can review this QC report.");
    if (report.status !== "SUBMITTED" || order.status !== "QC_PENDING") throw new AppError(409, "This QC report is no longer awaiting review.");

    const nextStatus = input.decision === "APPROVE" ? "APPROVED" : "RECHECK_REQUESTED";
    await prisma.$transaction(async tx => {
      const changed = await tx.qualityCheckReport.updateMany({
        where: { id: report.id, status: "SUBMITTED" },
        data: { status: nextStatus, buyerFeedback: input.feedback || null, reviewedByUserId: req.auth!.userId, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new AppError(409, "This QC report was already reviewed.");
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: input.decision === "APPROVE" ? "READY_TO_DISPATCH" : "IN_PRODUCTION", qcNotes: input.decision === "APPROVE" ? "Buyer approved the submitted quality inspection." : `Buyer requested QC recheck: ${input.feedback}` } });
      await tx.orderEvent.create({ data: { purchaseOrderId: order.id, eventType: input.decision === "APPROVE" ? "QC_APPROVED" : "QC_RECHECK_REQUESTED", note: input.feedback || "Buyer approved quality inspection.", actorUserId: req.auth!.userId } });
      const suppliers = await tx.organizationMember.findMany({ where: { organizationId: order.supplierOrgId, role: "SUPPLIER", isActive: true }, select: { userId: true } });
      if (suppliers.length) await tx.notification.createMany({ data: suppliers.map(s => ({ userId: s.userId, title: input.decision === "APPROVE" ? "QC approved by buyer" : "QC recheck requested", body: input.decision === "APPROVE" ? `QC for PO #${order.poNumber} is approved. You can proceed to dispatch.` : `Buyer requested corrections for PO #${order.poNumber}: ${input.feedback}` })) });
    });
    await audit(input.decision === "APPROVE" ? "QC_REPORT_APPROVED" : "QC_RECHECK_REQUESTED", "QualityCheckReport", report.id, req.auth!.userId, order.buyerOrgId, { purchaseOrderId: order.id, feedback: input.feedback || null });
    emitToOrg(order.buyerOrgId, "qc:reviewed", { orderId: order.id, reportId: report.id, decision: input.decision });
    emitToOrg(order.supplierOrgId, "qc:reviewed", { orderId: order.id, reportId: report.id, decision: input.decision });
    emitToRole("ADMIN", "qc:reviewed", { orderId: order.id, reportId: report.id, decision: input.decision });
    return sendOk(res, { reportId: report.id, status: nextStatus, orderStatus: input.decision === "APPROVE" ? "READY_TO_DISPATCH" : "IN_PRODUCTION" });
  } catch (error) { next(error); }
}

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      filename: z.string().min(1).max(255).default("file.jpg"),
      data: z.string().min(1),
      label: z.string().max(100).optional(),
    }).parse(req.body);

    let base64Data = input.data;
    let mimeType = "image/jpeg";
    let extension = path.extname(input.filename).replace(".", "").toLowerCase() || "jpg";

    if (input.data.startsWith("data:")) {
      const match = input.data.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,/);
      if (!match) throw new AppError(400, "Invalid base64 data URL.");
      mimeType = match[1].toLowerCase();
      base64Data = input.data.substring(match[0].length);
      if (mimeType === "image/png") extension = "png";
      else if (mimeType === "image/webp") extension = "webp";
      else if (mimeType === "application/pdf") extension = "pdf";
      else if (mimeType === "image/jpeg") extension = "jpg";
      else if (mimeType === "image/heic") extension = "heic";
      else if (mimeType === "image/heif") extension = "heif";
      else throw new AppError(415, "Only JPG, PNG, WEBP, HEIC, HEIF and PDF files are supported.");
    } else {
      const extMime: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
      };
      mimeType = extMime[extension] || "";
      if (!mimeType) throw new AppError(415, "Only JPG, PNG, WEBP, HEIC, HEIF and PDF files are supported.");
    }

    const safeFilename = `sg-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${extension}`;
    const buffer = Buffer.from(base64Data, "base64");
    if (!buffer.length) throw new AppError(400, "Uploaded file is empty or invalid.");
    if (buffer.length > 10 * 1024 * 1024) throw new AppError(413, "File size must be 10 MB or less.");

    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (cloudName && apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const businessMediaLabels = ["COMPANY_LOGO", "COVER_PHOTO", "COMPANY_PHOTO", "FACTORY_PHOTO", "WORK_PROCESS"];
      const folder = input.label?.startsWith("CAPABILITY_") ? "stitchgrid/capability-images" : businessMediaLabels.includes(input.label || "") ? "stitchgrid/business-gallery" : input.label === "PRODUCT_PORTFOLIO" ? "stitchgrid/product-portfolio" : input.label === "SUPPLIER_CERTIFICATE" ? "stitchgrid/certifications" : "stitchgrid/sample-attachments";
      const signature = createHash("sha1")
        .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
        .digest("hex");
      const form = new FormData();
      form.append("file", new Blob([buffer as unknown as BlobPart], { type: mimeType }), safeFilename);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("folder", folder);
      form.append("signature", signature);
      const resourceType = mimeType === "application/pdf" ? "raw" : "image";
      const cloudResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: "POST",
        body: form,
      });
      const cloudPayload: any = await cloudResponse.json().catch(() => ({}));
      if (!cloudResponse.ok || !cloudPayload.secure_url) {
        throw new AppError(502, cloudPayload.error?.message || "Persistent file storage upload failed.");
      }
      return sendOk(res, {
        url: cloudPayload.secure_url,
        filename: cloudPayload.original_filename || safeFilename,
        label: input.label || "Sample Attachment",
        size: cloudPayload.bytes || buffer.length,
        mimeType,
      }, 201);
    }

    if (env.NODE_ENV === "production") {
      throw new AppError(503, "Persistent file storage is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the backend environment.");
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, safeFilename), buffer);
    return sendOk(res, {
      url: `/uploads/${safeFilename}`,
      filename: safeFilename,
      label: input.label || "Sample Attachment",
      size: buffer.length,
      mimeType,
    }, 201);
  } catch (e) { next(e); }
}

export async function createSample(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      notes: z.string().max(20000).optional(),
      sampleType: z.string().trim().min(2).max(80).default("Final Sample"),
      sampleName: z.string().trim().max(180).optional(),
      quantity: z.string().trim().max(80).optional(),
    }).parse(req.body);
    const { order, memberships } = await orderAccess(req.params.orderId as string, req.auth!.userId);
    if (!memberships.some(m => m.role === "BUYER" && m.organizationId === order.buyerOrgId)) throw new AppError(403, "Buyer membership required");

    const createdAt = new Date().toISOString();
    const initialMeta = {
      description: input.notes || `Pre-Production Sample lot for ${order.poNumber}`,
      sampleType: input.sampleType,
      sampleName: input.sampleName || order.poNumber,
      quantity: input.quantity || "5 pcs",
      photos: [],
      files: [],
      supplierNote: "",
      buyerFeedback: null,
      history: [{ action: "Sample requested by Buyer", status: "REQUESTED", note: input.notes || "Pre-production prototype", createdAt, actorUserId: req.auth!.userId, actorRole: "BUYER" }],
      createdAt,
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
        note: `Sample ${sample.id}: ${input.sampleType} • ${input.quantity || "5 pcs"} • ${input.sampleName || order.poNumber}`,
        actorUserId: req.auth!.userId
      }
    }).catch(() => {});

    const supplierMembers = await prisma.organizationMember.findMany({
      where: { organizationId: order.supplierOrgId, role: "SUPPLIER", isActive: true },
      select: { userId: true },
    });
    const supplierUserIds = [...new Set(supplierMembers.map(member => member.userId))];
    if (supplierUserIds.length) {
      await prisma.notification.createMany({
        data: supplierUserIds.map(userId => ({
          userId,
          title: "New sample request",
          body: `Buyer requested a ${input.sampleType} (${input.quantity || "5 pcs"}) for order ${order.poNumber}.`,
        })),
      });
      supplierUserIds.forEach(userId => emitToUser(userId, "notification:new", { title: "New sample request", orderId: order.id, sampleId: sample.id }));
    }
    const adminMembers = await prisma.organizationMember.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { userId: true },
    });
    const adminUserIds = [...new Set(adminMembers.map(member => member.userId))];
    if (adminUserIds.length) {
      await prisma.notification.createMany({
        data: adminUserIds.map(userId => ({
          userId,
          title: "New sample request",
          body: `A buyer requested a ${input.sampleType} for purchase order ${order.poNumber}.`,
        })),
      });
      adminUserIds.forEach(userId => emitToUser(userId, "notification:new", { title: "New sample request", orderId: order.id, sampleId: sample.id }));
    }

    emitToOrg(order.buyerOrgId, "sample:created", { orderId: order.id, sampleId: sample.id });
    emitToOrg(order.supplierOrgId, "sample:created", { orderId: order.id, sampleId: sample.id });
    emitToRole("ADMIN", "sample:created", { orderId: order.id, sampleId: sample.id });

    return sendOk(res, { ...sample, parsedMeta: initialMeta, photos: [], files: [] }, 201);
  } catch (e) { next(e); }
}

export async function updateSample(req: Request, res: Response, next: NextFunction) {
  try {
    const fileSchema = z.object({
      url: z.string().min(1).max(2000),
      filename: z.string().max(255).optional(),
      label: z.string().max(100).default("Sample File"),
      size: z.number().nonnegative().optional(),
      mimeType: z.string().max(120).optional(),
    });
    const input = z.object({
      status: z.enum(["REQUESTED", "IN_PROGRESS", "DISPATCHED", "APPROVED", "REJECTED", "REVISION_REQUIRED"]).optional(),
      notes: z.string().max(20000).optional(),
      photos: z.array(z.object({
        url: z.string().min(1).max(2000),
        label: z.string().max(100).default("Sample Photo")
      })).max(30).optional(),
      files: z.array(fileSchema).max(30).optional(),
      supplierNote: z.string().max(5000).optional(),
      samplePrice: z.coerce.number().positive().max(9999999).optional(),
      feedback: z.string().trim().min(5).max(5000).optional()
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
    const supplier = req.auth!.role === "SUPPLIER" && memberships.some(m => m.role === "SUPPLIER" && m.organizationId === sample.purchaseOrder.supplierOrgId);
    const buyer = req.auth!.role === "BUYER" && memberships.some(m => m.role === "BUYER" && m.organizationId === sample.purchaseOrder.buyerOrgId);
    if (!supplier && !buyer) throw new AppError(403, "Sample access denied");

    if (input.status) {
      if (["IN_PROGRESS", "DISPATCHED"].includes(input.status) && !supplier) {
        throw new AppError(403, "Only supplier can update sample production or dispatch");
      }
      if (["APPROVED", "REJECTED", "REVISION_REQUIRED"].includes(input.status) && !buyer) {
        throw new AppError(403, "Only buyer can approve, reject or request revisions on a sample");
      }
    }
    if ((input.photos !== undefined || input.files !== undefined || input.supplierNote !== undefined || input.samplePrice !== undefined) && !supplier) {
      throw new AppError(403, "Only supplier can upload sample attachments, set sample price or update the supplier note");
    }
    if (input.samplePrice !== undefined && sample.status === "APPROVED") throw new AppError(409, "Sample price cannot be changed after buyer approval.");
    if (input.samplePrice !== undefined && !["ACCEPTED", "SAMPLE_PENDING"].includes(sample.purchaseOrder.status)) throw new AppError(409, "Supplier can set the sample price after accepting the purchase order.");

    let existingMeta: any = {};
    if (sample.notes) {
      try {
        existingMeta = JSON.parse(sample.notes);
      } catch {
        existingMeta = { description: sample.notes };
      }
    }

    if (input.samplePrice !== undefined && ["PENDING", "PAID"].includes(existingMeta.samplePaymentStatus)) throw new AppError(409, "Sample price cannot be changed after a payment has started or completed.");
    if (supplier && (input.photos !== undefined || input.files !== undefined) && existingMeta.samplePaymentStatus !== "PAID") throw new AppError(409, "Buyer sample payment must be successful before sample preparation photos or files can be submitted.");

    const now = new Date().toISOString();
    const newStatus = input.status || sample.status;
    const statusChanged = newStatus !== sample.status;
    if (supplier && ["IN_PROGRESS", "DISPATCHED"].includes(newStatus)) {
      if (!(Number(existingMeta.samplePrice) > 0)) throw new AppError(409, "Set the sample price before preparing or dispatching the sample.");
      if (existingMeta.samplePaymentStatus !== "PAID") throw new AppError(409, "Buyer sample payment must be successful before sample preparation or dispatch.");
    }
    if (buyer && ["APPROVED", "REJECTED", "REVISION_REQUIRED"].includes(newStatus) && sample.status !== "DISPATCHED") {
      throw new AppError(409, "The supplier must submit the sample before the buyer can review it.");
    }
    if (buyer && ["REJECTED", "REVISION_REQUIRED"].includes(newStatus) && (input.feedback || "").trim().length < 5) {
      throw new AppError(400, "Please provide at least 5 characters explaining the rejection or requested changes.");
    }
    const updatedMeta: any = {
      ...existingMeta,
      description: input.notes !== undefined ? input.notes : existingMeta.description,
      photos: input.photos !== undefined ? input.photos : (existingMeta.photos || []),
      files: input.files !== undefined ? input.files : (existingMeta.files || []),
      supplierNote: input.supplierNote !== undefined ? input.supplierNote : (existingMeta.supplierNote || ""),
      samplePrice: input.samplePrice !== undefined ? input.samplePrice : existingMeta.samplePrice,
      samplePriceCurrency: input.samplePrice !== undefined ? sample.purchaseOrder.currency : existingMeta.samplePriceCurrency,
      buyerFeedback: input.feedback !== undefined ? input.feedback : existingMeta.buyerFeedback,
      updatedAt: now,
      lastUpdatedBy: req.auth!.userId,
      history: [
        ...(Array.isArray(existingMeta.history) ? existingMeta.history : []),
        {
          action: statusChanged ? `Sample status changed to ${newStatus}` : (input.feedback ? "Buyer feedback added" : input.supplierNote ? "Supplier note updated" : input.photos || input.files ? "Sample attachments updated" : "Sample details updated"),
          status: newStatus,
          note: input.feedback || input.supplierNote || input.notes || "",
          createdAt: now,
          actorUserId: req.auth!.userId,
          actorRole: supplier ? "SUPPLIER" : "BUYER",
        },
      ],
    };

    if (supplier && newStatus === "DISPATCHED" && (updatedMeta.photos || []).length === 0) {
      throw new AppError(400, "Upload at least one sample photo before submitting the sample to the buyer.");
    }
    if (supplier && newStatus === "DISPATCHED" && !existingMeta.sampleSubmittedAt) {
      updatedMeta.sampleSubmittedAt = now;
    }

    const updated = await prisma.sample.update({
      where: { id: sample.id },
      data: { status: newStatus, notes: JSON.stringify(updatedMeta) }
    });
    if (supplier && newStatus === "DISPATCHED") {
      await prisma.purchaseOrder.updateMany({ where: { id: sample.purchaseOrderId, status: "ACCEPTED" }, data: { status: "SAMPLE_PENDING" } });
    }
    if (buyer && newStatus === "APPROVED") {
      await prisma.purchaseOrder.updateMany({
        where: { id: sample.purchaseOrderId, status: { in: ["ACCEPTED", "SAMPLE_PENDING"] } },
        data: { status: "SAMPLE_APPROVED" }
      });
    }

    await prisma.orderEvent.create({
      data: {
        purchaseOrderId: sample.purchaseOrderId,
        eventType: statusChanged ? `SAMPLE_${newStatus}` : "SAMPLE_UPDATED",
        note: `Sample ${sample.id}: ${input.feedback || input.supplierNote || input.notes || (input.photos || input.files ? "Sample attachments updated" : newStatus === "APPROVED" ? "Sample approved by buyer" : "Sample updated")}`,
        actorUserId: req.auth!.userId
      }
    }).catch(() => {});

    const shouldNotifyPartner = statusChanged || input.supplierNote !== undefined || input.samplePrice !== undefined || input.photos !== undefined || input.files !== undefined;
    if (shouldNotifyPartner) {
      const recipientRole = supplier ? "BUYER" : "SUPPLIER";
      const recipientOrgId = supplier ? sample.purchaseOrder.buyerOrgId : sample.purchaseOrder.supplierOrgId;
      const recipients = await prisma.organizationMember.findMany({
        where: { organizationId: recipientOrgId, role: recipientRole, isActive: true },
        select: { userId: true },
      });
      const recipientIds = [...new Set(recipients.map(member => member.userId))];
      const title = supplier
        ? (input.samplePrice !== undefined ? "Sample price set" : newStatus === "DISPATCHED" ? "Sample received" : statusChanged ? "Sample updated by supplier" : "Supplier added sample update")
        : (newStatus === "APPROVED" ? "Sample approved" : newStatus === "REVISION_REQUIRED" ? "Changes requested on sample" : "Sample rejected");
      const body = supplier
        ? (input.samplePrice !== undefined
          ? `Supplier set the sample price to ${sample.purchaseOrder.currency} ${input.samplePrice.toFixed(2)} for PO #${sample.purchaseOrder.poNumber}. Please review and pay the sample amount.`
          : newStatus === "DISPATCHED"
          ? `Your supplier has submitted sample ${sample.id} for order ${sample.purchaseOrder.poNumber}.`
          : statusChanged
            ? `Supplier updated the sample for order ${sample.purchaseOrder.poNumber}: ${newStatus.replaceAll("_", " ").toLowerCase()}.`
            : `Supplier added sample photos or notes for order ${sample.purchaseOrder.poNumber}.`)
        : `Buyer updated the sample for order ${sample.purchaseOrder.poNumber}: ${newStatus.replaceAll("_", " ").toLowerCase()}.${input.feedback ? ` Buyer feedback: ${input.feedback}` : ""}`;
      if (recipientIds.length) {
        await prisma.notification.createMany({ data: recipientIds.map(userId => ({ userId, title, body })) });
        recipientIds.forEach(userId => emitToUser(userId, "notification:new", { title, orderId: sample.purchaseOrderId, sampleId: sample.id }));
      }
      const adminMembers = await prisma.organizationMember.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { userId: true },
      });
      const adminUserIds = [...new Set(adminMembers.map(member => member.userId))];
      if (adminUserIds.length) {
        const adminTitle = "Sample workflow updated";
        const adminBody = `Sample ${sample.id} on PO ${sample.purchaseOrder.poNumber} changed to ${newStatus.replaceAll("_", " ")}.`;
        await prisma.notification.createMany({ data: adminUserIds.map(userId => ({ userId, title: adminTitle, body: adminBody })) });
        adminUserIds.forEach(userId => emitToUser(userId, "notification:new", { title: adminTitle, orderId: sample.purchaseOrderId, sampleId: sample.id }));
      }
    }

    await audit("SAMPLE_STATUS_UPDATED", "Sample", sample.id, req.auth!.userId);
    const eventPayload = { orderId: sample.purchaseOrderId, sampleId: sample.id, status: newStatus };
    emitToOrg(sample.purchaseOrder.buyerOrgId, "sample:updated", eventPayload);
    emitToOrg(sample.purchaseOrder.supplierOrgId, "sample:updated", eventPayload);
    emitToRole("ADMIN", "sample:updated", eventPayload);
    return sendOk(res, {
      ...updated,
      parsedNotes: updatedMeta,
      photos: updatedMeta.photos || [],
      files: updatedMeta.files || [],
      buyerFeedback: updatedMeta.buyerFeedback,
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
    if (input.status === "COMPLETED" && /quality|qc/i.test(milestone.title)) {
      await prisma.purchaseOrder.updateMany({ where: { id: milestone.purchaseOrderId, status: { in: ["PRODUCTION_STARTED", "IN_PRODUCTION", "QC_PENDING"] } }, data: { status: "READY_TO_DISPATCH" } });
    }
    if (input.status === "COMPLETED" && /dispatch/i.test(milestone.title)) {
      await prisma.purchaseOrder.updateMany({ where: { id: milestone.purchaseOrderId, status: { in: ["READY_TO_DISPATCH", "QC"] } }, data: { status: "DISPATCHED", dispatchDate: new Date() } });
    }
    if (input.status === "COMPLETED" && /dispatch|quality|qc/i.test(milestone.title)) {
      const [plan, workflowStages] = await Promise.all([
        prisma.paymentPlan.findUnique({ where: { purchaseOrderId: milestone.purchaseOrderId }, include: { milestones: true } }),
        prisma.orderMilestone.findMany({ where: { purchaseOrderId: milestone.purchaseOrderId } })
      ]);
      const production = plan?.milestones.find(item => item.title === "Production Payment");
      const finalPayment = plan?.milestones.find(item => item.title === "Final Payment");
      const qcComplete = workflowStages.some(item => /quality|qc/i.test(item.title) && item.status === "COMPLETED");
      const dispatchComplete = workflowStages.some(item => /dispatch/i.test(item.title) && item.status === "COMPLETED");
      if (qcComplete && dispatchComplete && production?.status === "PAID" && finalPayment?.status === "UPCOMING") {
        await prisma.paymentMilestone.update({ where: { id: finalPayment.id }, data: { status: "DUE" } });
        const dueBuyers = await prisma.organizationMember.findMany({ where: { organizationId: milestone.purchaseOrder.buyerOrgId, role: "BUYER", isActive: true }, select: { userId: true } });
        if (dueBuyers.length) {
          await prisma.notification.createMany({ data: dueBuyers.map(member => ({ userId: member.userId, title: "Final payment due", body: `QC and dispatch are complete for PO #${milestone.purchaseOrder.poNumber}. The remaining balance is now due.` })) });
          dueBuyers.forEach(member => emitToUser(member.userId, "notification:new", { orderId: milestone.purchaseOrderId, title: "Final payment due" }));
        }
        emitToOrg(milestone.purchaseOrder.buyerOrgId, "payment:updated", { orderId: milestone.purchaseOrderId, milestoneId: finalPayment.id, status: "DUE", stage: "FINAL" });
        emitToOrg(milestone.purchaseOrder.supplierOrgId, "payment:updated", { orderId: milestone.purchaseOrderId, milestoneId: finalPayment.id, status: "DUE", stage: "FINAL" });
      }
    }
    await prisma.orderEvent.create({ data: { purchaseOrderId: milestone.purchaseOrderId, eventType: "MILESTONE_" + input.status, note: milestone.title, actorUserId: req.auth!.userId } });
    const buyerMembers = await prisma.organizationMember.findMany({
      where: { organizationId: milestone.purchaseOrder.buyerOrgId, role: "BUYER", isActive: true },
      select: { userId: true },
    });
    const buyerUserIds = [...new Set(buyerMembers.map(member => member.userId))];
    if (buyerUserIds.length) {
      const title = "Production milestone updated";
      const body = `Supplier updated ${milestone.title} on PO #${milestone.purchaseOrder.poNumber} to ${input.status.replaceAll("_", " ").toLowerCase()}.`;
      await prisma.notification.createMany({ data: buyerUserIds.map(userId => ({ userId, title, body })) });
      buyerUserIds.forEach(userId => emitToUser(userId, "notification:new", { title, orderId: milestone.purchaseOrderId, milestoneId: milestone.id, status: input.status }));
    }
    emitToOrg(milestone.purchaseOrder.buyerOrgId, "milestone:updated", { orderId: milestone.purchaseOrderId, milestoneId: milestone.id, status: input.status });
    emitToOrg(milestone.purchaseOrder.supplierOrgId, "milestone:updated", { orderId: milestone.purchaseOrderId, milestoneId: milestone.id, status: input.status });
    emitToRole("ADMIN", "milestone:updated", { orderId: milestone.purchaseOrderId, milestoneId: milestone.id, status: input.status });
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

    // Fetch linked orders for these organization pairs
    const linkedOrders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { buyerOrgId: { in: orgIds }, supplierOrgId: { in: relatedOrgIds } },
          { supplierOrgId: { in: orgIds }, buyerOrgId: { in: relatedOrgIds } }
        ]
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        totalAmount: true,
        buyerOrgId: true,
        supplierOrgId: true,
        items: { select: { name: true }, take: 1 }
      },
      orderBy: { createdAt: "desc" }
    });

    const orderByOrgPair = new Map<string, (typeof linkedOrders)[number]>();
    for (const order of linkedOrders) {
      orderByOrgPair.set(`${order.buyerOrgId}:${order.supplierOrgId}`, order);
    }
    const withOrgs = conversations.map(c => {
      const order = orderByOrgPair.get(`${c.buyerOrgId}:${c.supplierOrgId}`) ||
        orderByOrgPair.get(`${c.supplierOrgId}:${c.buyerOrgId}`);
      return {
        ...c,
        buyer: orgMap.get(c.buyerOrgId) || { id: c.buyerOrgId, name: "Buyer Organization" },
        supplier: orgMap.get(c.supplierOrgId) || { id: c.supplierOrgId, name: "Supplier Partner" },
        linkedOrder: order ? {
          id: order.id,
          poNumber: order.poNumber,
          status: order.status,
          item: order.items?.[0]?.name || "Garment Order"
        } : null,
      };
    });

    // Sort by latest message date if available, otherwise conversation creation date
    withOrgs.sort((a, b) => {
      const dateA = a.messages?.[0]?.createdAt ? new Date(a.messages[0].createdAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.messages?.[0]?.createdAt ? new Date(b.messages[0].createdAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return sendOk(res, withOrgs);
  } catch (e) { next(e); }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const convId = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;
    const conversation = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conversation) throw new AppError(404, "Conversation not found");
    const member = await prisma.organizationMember.findFirst({
      where: {
        userId: req.auth!.userId,
        organizationId: { in: [conversation.buyerOrgId, conversation.supplierOrgId] },
        isActive: true
      }
    });
    if (!member) throw new AppError(403, "Conversation access denied");
    const messages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" }
    });

    const userIds = [...new Set(messages.map(m => m.senderUserId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const withSenders = messages.map(m => ({
      ...m,
      sender: userMap.get(m.senderUserId) || { id: m.senderUserId, fullName: "Member" }
    }));

    return sendOk(res, withSenders);
  } catch (e) { next(e); }
}

export async function listSamples(req: Request, res: Response, next: NextFunction) {
  try {
    const activeRole = req.auth!.role;
    if (activeRole !== "BUYER" && activeRole !== "SUPPLIER") return sendOk(res, []);
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.auth!.userId, isActive: true, role: activeRole }
    });
    const buyerOrgIds = activeRole === "BUYER" ? [...new Set(memberships.map(m => m.organizationId))] : [];
    const supplierOrgIds = activeRole === "SUPPLIER" ? [...new Set(memberships.map(m => m.organizationId))] : [];
    const accessFilters: any[] = [];
    if (buyerOrgIds.length) accessFilters.push({ buyerOrgId: { in: buyerOrgIds } });
    if (supplierOrgIds.length) accessFilters.push({ supplierOrgId: { in: supplierOrgIds } });
    if (!accessFilters.length) return sendOk(res, []);

    const samples = await prisma.sample.findMany({
      where: { purchaseOrder: { OR: accessFilters } },
      include: {
        purchaseOrder: {
          include: {
            buyer: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true, city: true } },
            items: true,
            quotation: { select: { sampleCost: true, sampleLeadDays: true, currency: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const mappedSamples = samples.map(s => {
      let parsedMeta: any = null;
      let description: string = s.notes || "";
      if (s.notes) {
        try {
          parsedMeta = JSON.parse(s.notes);
          if (parsedMeta && typeof parsedMeta === "object") {
            description = parsedMeta.description || "";
          }
        } catch {
          parsedMeta = { description: s.notes, photos: [], files: [], history: [] };
          description = s.notes;
        }
      }
      parsedMeta = parsedMeta || {};
      // Legacy purchase orders may have the sample cost saved on the accepted quotation
      // but not copied into the sample metadata. Reuse that agreed quote value.
      if (!(Number(parsedMeta.samplePrice) > 0) && Number(s.purchaseOrder.quotation?.sampleCost) > 0) {
        parsedMeta.samplePrice = Number(s.purchaseOrder.quotation.sampleCost);
        parsedMeta.samplePriceCurrency = s.purchaseOrder.quotation.currency || s.purchaseOrder.currency;
        parsedMeta.sampleLeadDays = s.purchaseOrder.quotation.sampleLeadDays ?? undefined;
      }
      const photos = Array.isArray(parsedMeta.photos) ? parsedMeta.photos : [];
      const files = Array.isArray(parsedMeta.files) ? parsedMeta.files : [];
      return {
        ...s,
        notes: description,
        description,
        sampleType: parsedMeta.sampleType || "Final Sample",
        sampleName: parsedMeta.sampleName || s.purchaseOrder.items?.[0]?.name || "Apparel Sample",
        quantity: parsedMeta.quantity || "5 pcs",
        supplierNote: parsedMeta.supplierNote || "",
        photos,
        files,
        buyerFeedback: parsedMeta.buyerFeedback || null,
        history: Array.isArray(parsedMeta.history) ? parsedMeta.history : [],
        parsedMeta,
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

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.auth!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return sendOk(res, { markedRead: result.count });
  } catch (e) { next(e); }
}

export async function clearAllNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.notification.deleteMany({ where: { userId: req.auth!.userId } });
    return sendOk(res, { deleted: result.count });
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
    if (!order || !["DELIVERED", "COMPLETED"].includes(order.status)) {
      throw new AppError(400, "Review requires a delivered or completed order");
    }
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