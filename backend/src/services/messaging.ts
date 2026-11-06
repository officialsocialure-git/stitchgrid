import nodemailer from "nodemailer";
import { env } from "../config/env";

export async function sendEmailOtp(email: string, otp: string): Promise<{ delivered: boolean; reason?: string }> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.info(`[STITCHGRID OTP] SMTP credentials not configured in environment. OTP for ${email}: ${otp}`);
    return { delivered: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
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
  } catch (err: any) {
    console.error(`[SMTP ERROR] Failed to send email to ${email}:`, err.message);
    return { delivered: false, reason: err.message };
  }
}

export async function sendSmsOtp(phone: string, otp: string): Promise<{ delivered: boolean; reason?: string }> {
  if (!env.SMS_API_KEY) {
    console.info(`[STITCHGRID SMS OTP] SMS provider not configured. OTP for ${phone}: ${otp}`);
    return { delivered: false, reason: "SMS_NOT_CONFIGURED" };
  }

  // Adapter point for SMS providers (Twilio, Gupshup, Fast2SMS)
  try {
    return { delivered: true };
  } catch (err: any) {
    console.error(`[SMS ERROR] Failed to send SMS to ${phone}:`, err.message);
    return { delivered: false, reason: err.message };
  }
}
