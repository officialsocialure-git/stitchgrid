import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";

async function supplierOrganization(req: Request) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: req.auth!.userId, role: "SUPPLIER", isActive: true, ...(req.auth?.organizationId ? { organizationId: req.auth.organizationId } : {}) },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new AppError(403, "Active supplier membership required");
  return membership.organizationId;
}

const supplierReelInclude = {
  organization: {
    select: {
      id: true, name: true, businessType: true, city: true, country: true, verificationStatus: true,
      businessMedia: { where: { mediaType: "COMPANY_LOGO" as const }, take: 1, select: { url: true } },
    },
  },
  products: { include: { catalogItem: { select: { id: true, name: true, itemType: true, imageUrl: true, moq: true, isActive: true } } } },
};

export async function listMySupplierReels(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await supplierOrganization(req);
    const items = await prisma.supplierReel.findMany({
      where: { organizationId },
      include: supplierReelInclude,
      orderBy: { createdAt: "desc" },
    });
    return sendOk(res, items);
  } catch (error) { next(error); }
}

export async function createSupplierReel(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      title: z.string().trim().min(2).max(120),
      videoUrl: z.string().url().max(2000).refine(value => {
        const parsed = new URL(value);
        return (parsed.hostname.toLowerCase() === "res.cloudinary.com" && parsed.pathname.includes("/video/upload/")) || parsed.pathname.startsWith("/uploads/");
      }, "Reel videos must be uploaded through STITCHGRID video storage."),
      durationSeconds: z.number().int().min(15).max(60),
      productIds: z.array(z.string().min(1)).max(20).default([]),
    }).parse(req.body);
    const organizationId = await supplierOrganization(req);
    const profile = await prisma.supplierProfile.findUnique({ where: { organizationId }, select: { id: true } });
    if (!profile) throw new AppError(409, "Complete your supplier profile before uploading a Reel");
    const uniqueProductIds = [...new Set(input.productIds)];
    if (uniqueProductIds.length) {
      const count = await prisma.catalogItem.count({
        where: { id: { in: uniqueProductIds }, supplierProfileId: profile.id, isActive: true },
      });
      if (count !== uniqueProductIds.length) throw new AppError(400, "Select only active products from your own catalog");
    }
    const reel = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierReel.create({
        data: {
          organizationId,
          title: input.title,
          videoUrl: input.videoUrl,
          durationSeconds: input.durationSeconds,
          status: "PENDING",
          isActive: false,
          ...(uniqueProductIds.length ? { products: { create: uniqueProductIds.map(catalogItemId => ({ catalogItemId })) } } : {}),
        },
      });
      return tx.supplierReel.findUnique({ where: { id: created.id }, include: supplierReelInclude });
    });
    await audit("SUPPLIER_REEL_SUBMITTED", "SupplierReel", reel!.id, req.auth!.userId, organizationId, { durationSeconds: input.durationSeconds, linkedProducts: uniqueProductIds.length });
    return sendOk(res, reel, 201);
  } catch (error) { next(error); }
}

export async function updateSupplierReel(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      title: z.string().trim().min(2).max(120).optional(),
      productIds: z.array(z.string().min(1)).max(20).optional(),
    }).refine(value => value.title !== undefined || value.productIds !== undefined).parse(req.body);
    const organizationId = await supplierOrganization(req);
    const reelId = String(req.params.reelId);
    const existing = await prisma.supplierReel.findFirst({ where: { id: reelId, organizationId } });
    if (!existing) throw new AppError(404, "Reel not found");
    const profile = await prisma.supplierProfile.findUnique({ where: { organizationId }, select: { id: true } });
    if (!profile) throw new AppError(409, "Complete your supplier profile before managing Reels");
    const productIds = input.productIds ? [...new Set(input.productIds)] : undefined;
    if (productIds?.length) {
      const count = await prisma.catalogItem.count({ where: { id: { in: productIds }, supplierProfileId: profile.id, isActive: true } });
      if (count !== productIds.length) throw new AppError(400, "Select only active products from your own catalog");
    }
    await prisma.$transaction(async tx => {
      if (productIds) {
        await tx.supplierReelProduct.deleteMany({ where: { reelId } });
        if (productIds.length) await tx.supplierReelProduct.createMany({ data: productIds.map(catalogItemId => ({ reelId, catalogItemId })) });
      }
      await tx.supplierReel.update({
        where: { id: reelId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          status: "PENDING",
          isActive: false,
          moderationNote: null,
        },
      });
    });
    const updated = await prisma.supplierReel.findUnique({ where: { id: reelId }, include: supplierReelInclude });
    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function deleteSupplierReel(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await supplierOrganization(req);
    const reelId = String(req.params.reelId);
    const existing = await prisma.supplierReel.findFirst({ where: { id: reelId, organizationId }, select: { id: true } });
    if (!existing) throw new AppError(404, "Reel not found");
    await prisma.supplierReel.delete({ where: { id: reelId } });
    await audit("SUPPLIER_REEL_DELETED", "SupplierReel", reelId, req.auth!.userId, organizationId);
    return sendOk(res, { id: reelId, deleted: true });
  } catch (error) { next(error); }
}

export async function listSupplierReelFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 5));
    const seed = String(req.query.seed || Date.now()).slice(0, 100);
    const viewerKey = String(req.auth?.userId || req.query.viewerKey || "anonymous").slice(0, 120);
    const where = {
      status: "APPROVED" as const,
      isActive: true,
      organization: {
        verificationStatus: "APPROVED" as const,
        members: { some: { role: "SUPPLIER" as const, isActive: true } },
      },
    };
    const [eligible, total, recentViews] = await Promise.all([
      prisma.supplierReel.findMany({ where, select: { id: true, organizationId: true, impressionCount: true } }),
      prisma.supplierReel.count({ where }),
      prisma.supplierReelEvent.findMany({
        where: { viewerKey, eventType: "VIEW", createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { reelId: true },
      }),
    ]);
    const viewedIds = new Set(recentViews.map(item => item.reelId));
    const hash = (value: string) => {
      let score = 2166136261;
      const source = seed + ":" + viewerKey + ":" + value;
      for (let index = 0; index < source.length; index += 1) {
        score ^= source.charCodeAt(index);
        score = Math.imul(score, 16777619);
      }
      return score >>> 0;
    };
    const supplierExposure = new Map<string, number>();
    for (const item of eligible) {
      supplierExposure.set(item.organizationId, (supplierExposure.get(item.organizationId) || 0) + item.impressionCount);
    }
    const sortFairly = (items: typeof eligible) => items.sort((a, b) =>
      (supplierExposure.get(a.organizationId) || 0) - (supplierExposure.get(b.organizationId) || 0) ||
      a.impressionCount - b.impressionCount ||
      hash(a.id) - hash(b.id)
    );
    const fresh = sortFairly(eligible.filter(item => !viewedIds.has(item.id)));
    const fallback = sortFairly(eligible.filter(item => viewedIds.has(item.id)));
    const candidates = [...fresh, ...fallback];
    const selectedIds: string[] = [];
    const selectedSuppliers = new Set<string>();
    for (const item of candidates) {
      if (selectedIds.length >= limit) break;
      if (!selectedSuppliers.has(item.organizationId)) {
        selectedIds.push(item.id);
        selectedSuppliers.add(item.organizationId);
      }
    }
    if (selectedIds.length < limit) {
      for (const item of candidates) {
        if (selectedIds.length >= limit) break;
        if (!selectedIds.includes(item.id)) selectedIds.push(item.id);
      }
    }
    const selected = selectedIds.length ? await prisma.supplierReel.findMany({
      where: { id: { in: selectedIds }, status: "APPROVED", isActive: true },
      include: supplierReelInclude,
    }) : [];
    const selectedById = new Map(selected.map(item => [item.id, item]));
    const items = selectedIds.map(id => selectedById.get(id)).filter((item): item is (typeof selected)[number] => Boolean(item));
    return sendOk(res, {
      items,
      total,
      hasMore: total > items.length,
      rotationSeed: seed,
      excludedRecentlyViewed: Math.min(viewedIds.size, total),
    });
  } catch (error) { next(error); }
}

export async function trackSupplierReelEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      eventKey: z.string().min(8).max(100),
      viewerKey: z.string().min(8).max(120),
      eventType: z.enum(["IMPRESSION", "VIEW", "CLICK"]),
      watchSeconds: z.number().int().min(0).max(60).default(0),
    }).parse(req.body);
    const reelId = String(req.params.reelId);
    const reel = await prisma.supplierReel.findFirst({ where: { id: reelId, status: "APPROVED", isActive: true }, select: { id: true } });
    if (!reel) throw new AppError(404, "Reel is not available");
    const viewerKey = String(req.auth?.userId || input.viewerKey).slice(0, 120);
    if (input.eventType === "VIEW") {
      const priorView = await prisma.supplierReelEvent.findFirst({
        where: { reelId, viewerKey, eventType: "VIEW", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { id: true },
      });
      if (priorView) return sendOk(res, { recorded: false, duplicate: true });
    }
    try {
      await prisma.$transaction(async tx => {
        await tx.supplierReelEvent.create({
          data: { reelId, eventKey: input.eventKey, viewerKey, eventType: input.eventType, watchSeconds: input.watchSeconds },
        });
        if (input.eventType === "IMPRESSION") {
          await tx.supplierReel.update({ where: { id: reelId }, data: { impressionCount: { increment: 1 } } });
        } else if (input.eventType === "VIEW") {
          await tx.supplierReel.update({ where: { id: reelId }, data: { viewCount: { increment: 1 } } });
        }
      });
    } catch (error: any) {
      if (error?.code === "P2002") return sendOk(res, { recorded: false, duplicate: true });
      throw error;
    }
    return sendOk(res, { recorded: true });
  } catch (error) { next(error); }
}

export async function listAdminSupplierReels(req: Request, res: Response, next: NextFunction) {
  try {
    const status = String(req.query.status || "ALL").toUpperCase();
    const where = ["PENDING", "APPROVED", "REJECTED", "HIDDEN"].includes(status) ? { status: status as any } : {};
    const [items, total, pending, approved, rejected] = await Promise.all([
      prisma.supplierReel.findMany({
        where,
        include: supplierReelInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.supplierReel.count(),
      prisma.supplierReel.count({ where: { status: "PENDING" } }),
      prisma.supplierReel.count({ where: { status: "APPROVED", isActive: true } }),
      prisma.supplierReel.count({ where: { status: "REJECTED" } }),
    ]);
    return sendOk(res, { items, total, stats: { pending, approved, rejected } });
  } catch (error) { next(error); }
}

export async function moderateSupplierReel(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      status: z.enum(["APPROVED", "REJECTED", "HIDDEN"]),
      moderationNote: z.string().trim().max(500).optional(),
    }).parse(req.body);
    const existing = await prisma.supplierReel.findUnique({
      where: { id: String(req.params.reelId) },
      include: { organization: { select: { id: true, verificationStatus: true } } },
    });
    if (!existing) throw new AppError(404, "Supplier Reel not found");
    if (input.status === "APPROVED" && existing.organization.verificationStatus !== "APPROVED") {
      throw new AppError(409, "Supplier organization must be verified before its Reel can be approved");
    }
    const item = await prisma.supplierReel.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        isActive: input.status === "APPROVED",
        moderationNote: input.moderationNote || null,
      },
      include: supplierReelInclude,
    });
    await audit("ADMIN_SUPPLIER_REEL_MODERATED", "SupplierReel", item.id, req.auth!.userId, existing.organization.id, { status: input.status, note: input.moderationNote || null });
    return sendOk(res, item);
  } catch (error) { next(error); }
}
