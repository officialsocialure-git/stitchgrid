import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";

async function supplierOrganization(req: Request) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: req.auth!.userId, role: "SUPPLIER", isActive: true, ...(req.auth?.organizationId ? { organizationId: req.auth.organizationId } : {}) },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new AppError(403, "Active supplier membership required");
  return membership.organizationId;
}

export async function getMyTrendyCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await supplierOrganization(req);
    const item = await prisma.trendyCollection.findUnique({ where: { organizationId } });
    return sendOk(res, item);
  } catch (error) { next(error); }
}

export async function upsertMyTrendyCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      imageUrl: z.string().url().max(2000),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const organizationId = await supplierOrganization(req);
    const [existing, organization] = await Promise.all([
      prisma.trendyCollection.findUnique({ where: { organizationId } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    ]);
    if (!organization) throw new AppError(404, "Supplier organization not found");
    const contentChanged = !existing || existing.imageUrl !== input.imageUrl;
    const item = await prisma.trendyCollection.upsert({
      where: { organizationId },
      create: { organizationId, name: organization.name, description: null, imageUrl: input.imageUrl, isActive: false, status: "PENDING" }, 
      update: {
        name: organization.name,
        description: null,
        imageUrl: input.imageUrl,
        status: contentChanged ? "PENDING" : (existing?.status ?? "PENDING"),
        isActive: !contentChanged && existing?.status === "APPROVED" ? (input.isActive ?? existing.isActive) : false,
        moderationNote: null,
      },
    });
    return sendOk(res, item, existing ? 200 : 201);
  } catch (error) { next(error); }
}

export async function listPublicTrendyCollections(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
    const seed = String(req.query.seed || "stitchgrid").slice(0, 80);
    const where = {
      status: "APPROVED" as const,
      isActive: true,
      organization: { verificationStatus: "APPROVED" as const, members: { some: { role: "SUPPLIER" as const, isActive: true } } },
    };
    // Use a request seed to create a fair, repeatable rotation for all pages
    // in one browsing session. A new refresh seed produces a new supplier order.
    const [eligible, total] = await Promise.all([
      prisma.trendyCollection.findMany({
        where, include: { organization: { select: { id: true, name: true, city: true, country: true } } },
      }),
      prisma.trendyCollection.count({ where }),
    ]);
    const seededScore = (value: string) => {
      let hash = 2166136261;
      const input = seed + ":" + value;
      for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    };
    eligible.sort((a, b) => seededScore(a.id) - seededScore(b.id));
    const items = eligible.slice((page - 1) * limit, page * limit);
    return sendOk(res, { items, page, limit, total, hasMore: page * limit < total, rotationSeed: seed });
  } catch (error) { next(error); }
}

export async function listAdminTrendyCollections(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "";
    const allowed = ["PENDING", "APPROVED", "REJECTED", "HIDDEN"];
    const items = await prisma.trendyCollection.findMany({
      where: allowed.includes(status) ? { status: status as any } : {},
      include: { organization: { select: { id: true, name: true, verificationStatus: true } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    });
    return sendOk(res, items);
  } catch (error) { next(error); }
}

export async function moderateTrendyCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      status: z.enum(["APPROVED", "REJECTED", "HIDDEN"]),
      moderationNote: z.string().trim().max(500).optional(),
    }).parse(req.body);
    const existing = await prisma.trendyCollection.findUnique({
      where: { id: String(req.params.collectionId) },
      include: { organization: { select: { verificationStatus: true } } },
    });
    if (!existing) throw new AppError(404, "Trendy Collection not found");
    if (input.status === "APPROVED" && existing.organization.verificationStatus !== "APPROVED") {
      throw new AppError(409, "Supplier organization must be verified before its Trendy Collection can be approved");
    }
    const item = await prisma.trendyCollection.update({
      where: { id: existing.id },
      data: { status: input.status, moderationNote: input.moderationNote || null, isActive: input.status === "APPROVED" },
    });
    return sendOk(res, item);
  } catch (error) { next(error); }
}
