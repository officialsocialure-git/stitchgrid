import { Response } from "express";
export function sendOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code = "REQUEST_ERROR") {
    super(message);
  }
}