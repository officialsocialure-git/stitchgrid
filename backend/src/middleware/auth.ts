import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/http";

export type AuthUser = { userId: string; organizationId?: string; role?: string };
declare global { namespace Express { interface Request { auth?: AuthUser } } }

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
  try {
    req.auth = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired access token", "INVALID_TOKEN"));
  }
}
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.role || !roles.includes(req.auth.role)) return next(new AppError(403, "Insufficient permission", "FORBIDDEN"));
    next();
  };
}