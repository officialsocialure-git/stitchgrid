import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { invalidateCachePattern } from "../services/cache";

export async function adminCertifications(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(120).optional(), status: z.enum(["ALL", "PENDING", "VERIFIED", "REJECTED"]).default("PENDING") }).parse(req.query);
    const where: any = {};
    if (parsed.status !== "ALL") where.status = parsed.status;
    if (parsed.q) where.OR = [{ name: { contains: parsed.q } }, { issuer: { contains: parsed.q } }, { certificateNumber: { contains: parsed.q } }];
    const [items, total] = await Promise.all([
      prisma.supplierCertification.findMany({ where, include: { supplierProfile: { include: { organization: { select: { id: true, name: true, city: true, country: true } } } } }, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.supplierCertification.count({ where })
    ]);
    return sendOk(res, { items, page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) });
  } catch (error) { next(error); }
}

export async function adminReviewCertification(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ status: z.enum(["VERIFIED", "REJECTED"]), note: z.string().max(2000).optional() }).parse(req.body);
    const item = await prisma.supplierCertification.update({ where: { id: String(req.params.certificationId) }, data: { status: input.status, reviewNote: input.note || null } });
    await audit("ADMIN_CERTIFICATION_REVIEW", "SupplierCertification", item.id, req.auth!.userId, undefined, { status: input.status, note: input.note });
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, item);
  } catch (error) { next(error); }
}