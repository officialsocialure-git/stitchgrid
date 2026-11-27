import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { invalidateCachePattern } from "../services/cache";

const priceTierSchema = z.object({
  minQuantity: z.coerce.number().int().positive(),
  maxQuantity: z.coerce.number().int().positive().nullable().optional(),
  unitPrice: z.coerce.number().positive(),
});

const productFields = {
  name: z.string().trim().min(2).max(180),
  itemType: z.string().trim().min(2).max(100),
  description: z.string().max(4000).optional(),
  moq: z.coerce.number().int().positive().optional(),
  unitPrice: z.coerce.number().positive().optional(),
  currency: z.string().length(3).default("INR"),
  imageUrl: z.string().url().max(2000).optional(),
  additionalImageUrls: z.array(z.string().url().max(2000)).max(5).optional().default([]),
  gender: z.string().max(30).optional(),
  material: z.string().max(120).optional(),
  gsm: z.coerce.number().int().positive().max(2000).optional(),
  sizes: z.array(z.string().trim().min(1).max(30)).max(30).optional().default([]),
  colors: z.array(z.string().trim().min(1).max(50)).max(40).optional().default([]),
  manufacturingType: z.string().max(80).optional(),
  customization: z.boolean().optional().default(false),
  priceTiers: z.array(priceTierSchema).max(20).optional().default([]),
};

export async function listMyCatalogItems(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.query.organizationId || "");
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");
    const profile = await prisma.supplierProfile.findUnique({ where: { organizationId }, select: { id: true } });
    if (!profile) return sendOk(res, []);
    const items = await prisma.catalogItem.findMany({
      where: { supplierProfileId: profile.id },
      include: { images: { orderBy: { sortOrder: "asc" } }, priceTiers: { orderBy: { minQuantity: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
    return sendOk(res, items);
  } catch (error) { next(error); }
}

export async function createCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ organizationId: z.string().min(1), ...productFields }).parse(req.body);
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");

    const created = await prisma.$transaction(async (tx) => {
      const profile = await tx.supplierProfile.upsert({
        where: { organizationId: input.organizationId }, create: { organizationId: input.organizationId }, update: {}
      });
      await tx.supplierCategory.upsert({
        where: { supplierProfileId_category: { supplierProfileId: profile.id, category: input.itemType } },
        create: { supplierProfileId: profile.id, category: input.itemType }, update: {}
      });
      return tx.catalogItem.create({
        data: {
          supplierProfileId: profile.id, name: input.name, itemType: input.itemType,
          description: input.description, moq: input.moq, unitPrice: input.unitPrice,
          currency: input.currency, imageUrl: input.imageUrl, gender: input.gender,
          material: input.material, gsm: input.gsm, sizes: input.sizes.join(","),
          colors: input.colors.join(","), manufacturingType: input.manufacturingType,
          customization: input.customization, moderationStatus: "PENDING", isActive: true,
          images: input.additionalImageUrls.length ? { create: input.additionalImageUrls.map((imageUrl, index) => ({ imageUrl, sortOrder: index + 1 })) } : undefined,
          priceTiers: input.priceTiers.length ? { create: input.priceTiers.map(tier => ({ minQuantity: tier.minQuantity, maxQuantity: tier.maxQuantity ?? null, unitPrice: tier.unitPrice })) } : undefined
        },
        include: { images: { orderBy: { sortOrder: "asc" } }, priceTiers: { orderBy: { minQuantity: "asc" } } }
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
      name: productFields.name.optional(), itemType: productFields.itemType.optional(),
      description: z.string().max(4000).nullable().optional(),
      moq: z.coerce.number().int().positive().nullable().optional(),
      unitPrice: z.coerce.number().positive().nullable().optional(),
      currency: z.string().length(3).optional(), imageUrl: z.string().url().max(2000).nullable().optional(),
      gender: z.string().max(30).nullable().optional(), material: z.string().max(120).nullable().optional(),
      gsm: z.coerce.number().int().positive().max(2000).nullable().optional(),
      sizes: z.array(z.string().trim().min(1).max(30)).max(30).optional(),
      colors: z.array(z.string().trim().min(1).max(50)).max(40).optional(),
      manufacturingType: z.string().max(80).nullable().optional(), customization: z.boolean().optional(),
      additionalImageUrls: z.array(z.string().url().max(2000)).max(5).optional(),
      priceTiers: z.array(priceTierSchema).max(20).optional(),
    }).refine(value => Object.keys(value).length > 0, "At least one field is required").parse(req.body);
    const item = await prisma.catalogItem.findUnique({ where: { id: String(req.params.itemId) }, include: { supplierProfile: true } });
    if (!item) throw new AppError(404, "Product not found");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: item.supplierProfile.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");

    const { additionalImageUrls, priceTiers, sizes, colors, ...fields } = input;
    const updated = await prisma.$transaction(async tx => {
      if (additionalImageUrls !== undefined) await tx.catalogItemImage.deleteMany({ where: { catalogItemId: item.id } });
      if (priceTiers !== undefined) await tx.catalogItemPriceTier.deleteMany({ where: { catalogItemId: item.id } });
      return tx.catalogItem.update({
        where: { id: item.id },
        data: {
          ...fields, ...(sizes !== undefined ? { sizes: sizes.join(",") } : {}),
          ...(colors !== undefined ? { colors: colors.join(",") } : {}),
          moderationStatus: "PENDING", moderationNote: null,
          ...(additionalImageUrls !== undefined && additionalImageUrls.length ? { images: { create: additionalImageUrls.map((imageUrl, index) => ({ imageUrl, sortOrder: index + 1 })) } } : {}),
          ...(priceTiers !== undefined && priceTiers.length ? { priceTiers: { create: priceTiers.map(tier => ({ minQuantity: tier.minQuantity, maxQuantity: tier.maxQuantity ?? null, unitPrice: tier.unitPrice })) } } : {})
        },
        include: { images: { orderBy: { sortOrder: "asc" } }, priceTiers: { orderBy: { minQuantity: "asc" } } }
      });
    });
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

export async function listMarketplaceProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z.object({
      category: z.string().trim().max(100).optional(),
      gender: z.string().trim().max(30).optional(),
      q: z.string().trim().max(120).optional(),
      minMoq: z.coerce.number().int().positive().optional(),
      maxPrice: z.coerce.number().positive().optional(),
      minPrice: z.coerce.number().nonnegative().optional(),
      supplierType: z.string().trim().max(80).optional(),
      city: z.string().trim().max(100).optional(),
      sort: z.enum(["RECOMMENDED", "PRICE_LOW", "PRICE_HIGH", "NEWEST"]).default("RECOMMENDED"),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(60).default(20)
    }).parse(req.query);
    const where: any = {
      moderationStatus: "APPROVED", isActive: true,
      supplierProfile: { organization: { verificationStatus: "APPROVED", members: { some: { role: "SUPPLIER", isActive: true } } } }
    };
    if (query.category) {
      const singular: Record<string, string> = { "t-shirts": "T-Shirt", "polo t-shirts": "Polo T-Shirt", "dresses": "Dress", "shirts": "Shirt", "hoodies": "Hoodie", "sweatshirts": "Sweatshirt", "tops": "Top", "kurtis": "Kurti", "trousers": "Trouser", "shorts": "Short", "skirts": "Skirt", "co-ord sets": "Co-ord Set", "tracksuits": "Tracksuit", "joggers": "Jogger", "leggings": "Legging", "jackets": "Jacket", "blazers": "Blazer", "sweaters": "Sweater" };
      const term = singular[query.category.toLowerCase()] || query.category;
      where.itemType = { contains: term };
    }
    if (query.gender && query.gender !== "All") where.gender = query.gender;
    if (query.q) where.OR = [{ name: { contains: query.q } }, { description: { contains: query.q } }, { itemType: { contains: query.q } }, { material: { contains: query.q } }];
    if (query.minMoq) where.moq = { lte: query.minMoq };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceRange = { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) };
      where.AND = [...(where.AND || []), { OR: [{ unitPrice: priceRange }, { priceTiers: { some: { unitPrice: priceRange } } }] }];
    }
    if (query.supplierType) where.supplierProfile.organization.businessType = { contains: query.supplierType };
    if (query.city) where.supplierProfile.organization.city = { contains: query.city };
    const orderBy = query.sort === "PRICE_LOW" ? { unitPrice: "asc" as const } : query.sort === "PRICE_HIGH" ? { unitPrice: "desc" as const } : { createdAt: "desc" as const };
    const [items, total] = await Promise.all([
      prisma.catalogItem.findMany({
        where, include: {
          images: { orderBy: { sortOrder: "asc" } },
          priceTiers: { orderBy: { minQuantity: "asc" } },
          supplierProfile: { include: { organization: { select: { id: true, name: true, city: true, country: true, businessType: true, verificationStatus: true } } } }
        }, orderBy, skip: (query.page - 1) * query.limit, take: query.limit
      }),
      prisma.catalogItem.count({ where })
    ]);
    return sendOk(res, { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) });
  } catch (error) { next(error); }
}

export async function getMarketplaceProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.catalogItem.findFirst({
      where: {
        id: String(req.params.productId), moderationStatus: "APPROVED", isActive: true,
        supplierProfile: { organization: { verificationStatus: "APPROVED", members: { some: { role: "SUPPLIER", isActive: true } } } }
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        priceTiers: { orderBy: { minQuantity: "asc" } },
        supplierProfile: { include: { organization: { select: { id: true, name: true, city: true, country: true, businessType: true, verificationStatus: true } } } }
      }
    });
    if (!item) throw new AppError(404, "Product not found or no longer available");
    return sendOk(res, item);
  } catch (error) { next(error); }
}
