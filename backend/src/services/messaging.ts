import nodemailer from "nodemailer";
import { env } from "../config/env";

export async function sendEmailOtp(email: string, otp: string) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    if (env.NODE_ENV !== "production") { console.info(`[DEV OTP] ${email}: ${otp}`); return; }
    throw new Error("SMTP is not configured");
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
  await transport.sendMail({ from: env.SMTP_FROM, to: email, subject: "Your STITCHGRID verification code", text: `Your OTP is ${otp}. It expires in ${env.OTP_TTL_MINUTES} minutes.` });
}
export async function sendSmsOtp(phone: string, otp: string) {
  // Connect an approved SMS provider adapter here before production use.
  if (env.NODE_ENV !== "production") { console.info(`[DEV SMS OTP] ${phone}: ${otp}`); return; }
  throw new Error("SMS provider adapter is not configured");
}