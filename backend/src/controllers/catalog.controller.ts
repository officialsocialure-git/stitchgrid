import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { invalidateCachePattern } from "../services/cache";

export async function listMyCatalogItems(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.query.organizationId || "");
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");
    // Product publishing is self-service: migrate any legacy pending listings
    // to approved as they are loaded, then return the full supplier portfolio.
    const profile = await prisma.supplierProfile.findUnique({ where: { organizationId }, select: { id: true } });
    if (!profile) return sendOk(res, []);
    await prisma.catalogItem.updateMany({ where: { supplierProfileId: profile.id, moderationStatus: { not: "APPROVED" } }, data: { moderationStatus: "APPROVED", moderationNote: null } });
    const items = await prisma.catalogItem.findMany({ where: { supplierProfileId: profile.id }, orderBy: { createdAt: "desc" } });
    return sendOk(res, items);
  } catch (error) { next(error); }
}

export async function createCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string().min(1),
      name: z.string().trim().min(2).max(180),
      itemType: z.string().trim().min(2).max(100),
      description: z.string().max(4000).optional(),
      moq: z.coerce.number().int().positive().optional(),
      unitPrice: z.coerce.number().positive().optional(),
      currency: z.string().length(3).default("INR"),
      imageUrl: z.string().url().max(2000).optional(),
    }).parse(req.body);

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");

    const created = await prisma.$transaction(async (tx) => {
      const profile = await tx.supplierProfile.upsert({
        where: { organizationId: input.organizationId },
        create: { organizationId: input.organizationId },
        update: {}
      });
      await tx.supplierCategory.upsert({
        where: { supplierProfileId_category: { supplierProfileId: profile.id, category: input.itemType } },
        create: { supplierProfileId: profile.id, category: input.itemType },
        update: {}
      });
      return tx.catalogItem.create({
        data: {
          supplierProfileId: profile.id,
          name: input.name,
          itemType: input.itemType,
          description: input.description,
          moq: input.moq,
          unitPrice: input.unitPrice,
          currency: input.currency,
          imageUrl: input.imageUrl,
          moderationStatus: "APPROVED"
        }
      });
    });

    await audit("CATALOG_ITEM_SUBMITTED", "CatalogItem", created.id, req.auth!.userId, input.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, created, 201);
  } catch (error) { next(error); }
}

export async function updateCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(180).optional(),
      itemType: z.string().trim().min(2).max(100).optional(),
      description: z.string().max(4000).nullable().optional(),
      moq: z.coerce.number().int().positive().nullable().optional(),
      unitPrice: z.coerce.number().positive().nullable().optional(),
      currency: z.string().length(3).optional(),
      imageUrl: z.string().url().max(2000).nullable().optional(),
    }).refine(value => Object.keys(value).length > 0, "At least one field is required").parse(req.body);
    const item = await prisma.catalogItem.findUnique({ where: { id: String(req.params.itemId) }, include: { supplierProfile: true } });
    if (!item) throw new AppError(404, "Product not found");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: item.supplierProfile.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");
    const updated = await prisma.catalogItem.update({ where: { id: item.id }, data: { ...input, moderationStatus: "APPROVED", moderationNote: null } });
    await audit("CATALOG_ITEM_UPDATED", "CatalogItem", item.id, req.auth!.userId, item.supplierProfile.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function deleteCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.catalogItem.findUnique({ where: { id: String(req.params.itemId) }, include: { supplierProfile: true } });
    if (!item) throw new AppError(404, "Product not found");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: item.supplierProfile.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");
    await prisma.catalogItem.delete({ where: { id: item.id } });
    await audit("CATALOG_ITEM_DELETED", "CatalogItem", item.id, req.auth!.userId, item.supplierProfile.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, { deleted: true, id: item.id });
  } catch (error) { next(error); }
}
