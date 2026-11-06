import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/http";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof SyntaxError && "status" in err && (err as any).status === 400) {
    return res.status(400).json({ success: false, error: { code: "INVALID_JSON", message: "Malformed JSON payload in request body" } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", details: err.flatten() } });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
  }
  console.error(err);
  return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
}