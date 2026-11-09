import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/http";
import { prisma } from "../config/prisma";

export type AuthUser = { userId: string; organizationId?: string; role?: string };
declare global { namespace Express { interface Request { auth?: AuthUser } } }

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    if (!payload?.userId) return next(new AppError(401, "Invalid access token", "INVALID_TOKEN"));
    const account = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isActive: true } });
    if (!account?.isActive) return next(new AppError(401, "Account is inactive or no longer available", "ACCOUNT_INACTIVE"));
    req.auth = payload;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired access token", "INVALID_TOKEN"));
  }
}

export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    if (payload?.userId) {
      const account = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isActive: true } });
      if (account?.isActive) {
        req.auth = payload;
      }
    }
  } catch {
    // Soft ignore for optional auth endpoints
  }
  next();
}
export function requireRole(...roles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.role || !roles.includes(req.auth.role)) return next(new AppError(403, "Insufficient permission", "FORBIDDEN"));
    if (req.auth.role === "ADMIN" && roles.includes("ADMIN")) {
      try {
        const [user, membership] = await Promise.all([
          prisma.user.findUnique({ where: { id: req.auth.userId }, select: { isActive: true } }),
          prisma.organizationMember.findFirst({
            where: { userId: req.auth.userId, role: "ADMIN", isActive: true, ...(req.auth.organizationId ? { organizationId: req.auth.organizationId } : {}) },
            select: { id: true }
          })
        ]);
        if (!user?.isActive || !membership) return next(new AppError(403, "Active administrator membership required", "ADMIN_ACCESS_REVOKED"));
      } catch (error) { return next(error); }
    }
    next();
  };
}