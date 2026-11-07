import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";

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
          moderationStatus: "PENDING"
        }
      });
    });

    await audit("CATALOG_ITEM_SUBMITTED", "CatalogItem", created.id, req.auth!.userId, input.organizationId);
    return sendOk(res, created, 201);
  } catch (error) { next(error); }
}
