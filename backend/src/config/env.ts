import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("24h"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  OTP_TTL_MINUTES: z.coerce.number().default(5),
  OTP_RESEND_SECONDS: z.coerce.number().default(45),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  CLIENT_ORIGIN: z.string().default("https://stitchgrid-three.vercel.app,http://localhost:3000"),
  REDIS_URL: z.string().optional(),
  // Resend Email API (HTTPS)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("STITCHGRID <onboarding@resend.dev>"),
  ALLOW_DEV_OTP: z.string().optional().transform(v => v === "true" || v === "1"),
  RESEND_TEST_RECIPIENT: z.string().optional(),
  // Legacy SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("STITCHGRID <no-reply@example.com>"),
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_TEMPLATE_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional()
});
export const env = schema.parse(process.env);