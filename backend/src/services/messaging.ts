import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../utils/http";

export type OtpChannel = "email" | "sms";

export function assertOtpDeliveryConfigured(channel: OtpChannel) {
  if (env.NODE_ENV === "production" && !env.REDIS_URL) {
    throw new AppError(503, "Secure OTP storage is not configured. Please contact support.", "OTP_STORAGE_NOT_CONFIGURED");
  }

  if (channel === "email") {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      throw new AppError(503, "Email OTP delivery is not configured. Please contact support.", "EMAIL_OTP_NOT_CONFIGURED");
    }
    return;
  }

  if (
    env.SMS_PROVIDER?.toUpperCase() !== "MSG91" ||
    !env.SMS_API_KEY ||
    !env.SMS_TEMPLATE_ID
  ) {
    throw new AppError(503, "SMS OTP delivery is not configured. Please contact support.", "SMS_OTP_NOT_CONFIGURED");
  }
}

export async function sendEmailOtp(email: string, otp: string): Promise<{ delivered: true }> {
  assertOtpDeliveryConfigured("email");

  try {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: "Your STITCHGRID verification code",
      text: `Your STITCHGRID verification code is: ${otp}\n\nIt expires in ${env.OTP_TTL_MINUTES} minutes. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #5B13EC; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">STITCHGRID</h1>
            <p style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-top: 4px;">Garment Manufacturing Network</p>
          </div>
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">Here is your single-use 6-digit verification code to complete your authentication:</p>
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
            This code will expire in <strong>${env.OTP_TTL_MINUTES} minutes</strong>. For your security, do not share this code with anyone.
          </p>
        </div>
      `,
    });

    return { delivered: true };
  } catch (error) {
    console.error("[SMTP ERROR] OTP delivery failed:", error instanceof Error ? error.message : "Unknown error");
    throw new AppError(502, "We could not send the verification email. Please try again shortly.", "EMAIL_OTP_DELIVERY_FAILED");
  }
}

export async function sendSmsOtp(phone: string, otp: string): Promise<{ delivered: true }> {
  assertOtpDeliveryConfigured("sms");

  let mobile = phone.replace(/[^\d]/g, "");
  if (mobile.length === 10) mobile = `91${mobile}`;
  if (mobile.length < 10 || mobile.length > 15) {
    throw new AppError(400, "Please enter a valid mobile number with country code.", "INVALID_PHONE");
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: env.SMS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        template_id: env.SMS_TEMPLATE_ID,
        recipients: [{ mobiles: mobile, VAR1: otp }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const providerMessage = await response.text();
      console.error("[MSG91 ERROR] OTP delivery failed:", response.status, providerMessage.slice(0, 300));
      throw new Error("SMS provider rejected the request");
    }

    const result = await response.json() as { type?: string; message?: string };
    if (result.type && result.type.toLowerCase() === "error") {
      console.error("[MSG91 ERROR] OTP delivery rejected:", result.message || "Unknown provider error");
      throw new Error("SMS provider rejected the request");
    }

    return { delivered: true };
  } catch (error) {
    console.error("[MSG91 ERROR] OTP delivery failed:", error instanceof Error ? error.message : "Unknown error");
    throw new AppError(502, "We could not send the verification SMS. Please try again shortly.", "SMS_OTP_DELIVERY_FAILED");
  }
}
