import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { invalidateCachePattern } from "../services/cache";

async function getSupplierProfile(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId, role: "SUPPLIER", isActive: true }, select: { id: true }
  });
  if (!membership) throw new AppError(403, "Active supplier membership required");
  return prisma.supplierProfile.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
}

export async function listMyCertifications(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.query.organizationId || "");
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    const profile = await getSupplierProfile(req.auth!.userId, organizationId);
    const items = await prisma.supplierCertification.findMany({ where: { supplierProfileId: profile.id }, orderBy: { createdAt: "desc" } });
    return sendOk(res, items);
  } catch (error) { next(error); }
}

export async function createCertification(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string().min(1), name: z.string().trim().min(2).max(180),
      issuer: z.string().trim().max(180).optional(), category: z.string().trim().max(120).optional(),
      certificateNumber: z.string().trim().max(120).optional(), documentUrl: z.string().url().max(2000).optional(),
      issuedAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional()
    }).refine(v => !v.issuedAt || !v.expiresAt || v.expiresAt >= v.issuedAt, { message: "Expiry date must be on or after issue date", path: ["expiresAt"] }).parse(req.body);
    const profile = await getSupplierProfile(req.auth!.userId, input.organizationId);
    const created = await prisma.supplierCertification.create({ data: {
      supplierProfileId: profile.id, name: input.name, issuer: input.issuer || null, category: input.category || null,
      certificateNumber: input.certificateNumber || null, documentUrl: input.documentUrl || null,
      issuedAt: input.issuedAt || null, expiresAt: input.expiresAt || null, status: "PENDING"
    } });
    await audit("CERTIFICATION_SUBMITTED", "SupplierCertification", created.id, req.auth!.userId, input.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, created, 201);
  } catch (error) { next(error); }
}

export async function updateCertification(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(180).optional(), issuer: z.string().trim().max(180).nullable().optional(),
      category: z.string().trim().max(120).nullable().optional(), certificateNumber: z.string().trim().max(120).nullable().optional(),
      documentUrl: z.string().url().max(2000).nullable().optional(), issuedAt: z.coerce.date().nullable().optional(),
      expiresAt: z.coerce.date().nullable().optional()
    }).refine(v => Object.keys(v).length > 0, "At least one field is required").parse(req.body);
    const item = await prisma.supplierCertification.findUnique({ where: { id: String(req.params.certificationId) }, include: { supplierProfile: true } });
    if (!item) throw new AppError(404, "Certification not found");
    const profile = await getSupplierProfile(req.auth!.userId, item.supplierProfile.organizationId);
    if (profile.id !== item.supplierProfileId) throw new AppError(403, "Certification access denied");
    const updated = await prisma.supplierCertification.update({ where: { id: item.id }, data: { ...input, status: "PENDING", reviewNote: null } });
    await audit("CERTIFICATION_UPDATED", "SupplierCertification", item.id, req.auth!.userId, item.supplierProfile.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function deleteCertification(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.supplierCertification.findUnique({ where: { id: String(req.params.certificationId) }, include: { supplierProfile: true } });
    if (!item) throw new AppError(404, "Certification not found");
    await getSupplierProfile(req.auth!.userId, item.supplierProfile.organizationId);
    await prisma.supplierCertification.delete({ where: { id: item.id } });
    await audit("CERTIFICATION_DELETED", "SupplierCertification", item.id, req.auth!.userId, item.supplierProfile.organizationId);
    await invalidateCachePattern("cache:suppliers:");
    return sendOk(res, { deleted: true, id: item.id });
  } catch (error) { next(error); }
}