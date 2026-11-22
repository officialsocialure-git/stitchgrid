import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { invalidateCachePattern } from "../services/cache";

async function requireSupplierOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId, role: "SUPPLIER", isActive: true },
    select: { id: true },
  });
  if (!membership) throw new AppError(403, "Active supplier membership required");
}

export async function listSupplierTestimonials(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.query.organizationId || "");
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    await requireSupplierOrganization(req.auth!.userId, organizationId);
    const items = await prisma.supplierTestimonial.findMany({
      where: { organizationId }, orderBy: { createdAt: "desc" },
    });
    return sendOk(res, items);
  } catch (error) { next(error); }
}

export async function createSupplierTestimonial(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string().min(1),
      customerName: z.string().trim().min(2).max(150),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(3).max(2000),
    }).parse(req.body);
    await requireSupplierOrganization(req.auth!.userId, input.organizationId);
    const created = await prisma.supplierTestimonial.create({ data: input });
    await audit("SUPPLIER_TESTIMONIAL_CREATED", "SupplierTestimonial", created.id, req.auth!.userId, input.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, created, 201);
  } catch (error) { next(error); }
}

export async function updateSupplierTestimonial(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      customerName: z.string().trim().min(2).max(150).optional(),
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().trim().min(3).max(2000).optional(),
    }).refine(value => Object.keys(value).length > 0, "At least one field is required").parse(req.body);
    const item = await prisma.supplierTestimonial.findUnique({ where: { id: String(req.params.testimonialId) } });
    if (!item) throw new AppError(404, "Testimonial not found");
    await requireSupplierOrganization(req.auth!.userId, item.organizationId);
    const updated = await prisma.supplierTestimonial.update({ where: { id: item.id }, data: input });
    await audit("SUPPLIER_TESTIMONIAL_UPDATED", "SupplierTestimonial", item.id, req.auth!.userId, item.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function deleteSupplierTestimonial(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.supplierTestimonial.findUnique({ where: { id: String(req.params.testimonialId) } });
    if (!item) throw new AppError(404, "Testimonial not found");
    await requireSupplierOrganization(req.auth!.userId, item.organizationId);
    await prisma.supplierTestimonial.delete({ where: { id: item.id } });
    await audit("SUPPLIER_TESTIMONIAL_DELETED", "SupplierTestimonial", item.id, req.auth!.userId, item.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, { deleted: true, id: item.id });
  } catch (error) { next(error); }
}
