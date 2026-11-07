import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../utils/http";

export type OtpChannel = "email" | "sms";

export interface SendOtpResult {
  delivered: boolean;
  provider: "resend" | "resend_sandbox" | "smtp" | "dev_mode";
  devOtp?: string;
  sandboxNotice?: string;
}

export function assertOtpDeliveryConfigured(channel: OtpChannel) {
  if (channel === "email") {
    const hasResend = Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.trim());
    const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
    const isDevOrTest = env.NODE_ENV !== "production" || Boolean(env.ALLOW_DEV_OTP);

    if (!hasResend && !hasSmtp && !isDevOrTest) {
      throw new AppError(
        503,
        "Email delivery is not configured. Please set RESEND_API_KEY in backend environment variables.",
        "EMAIL_OTP_NOT_CONFIGURED"
      );
    }
    return;
  }

  if (channel === "sms") {
    if (
      env.SMS_PROVIDER?.toUpperCase() !== "MSG91" ||
      !env.SMS_API_KEY ||
      !env.SMS_TEMPLATE_ID
    ) {
      if (env.NODE_ENV !== "production" || Boolean(env.ALLOW_DEV_OTP)) {
        return;
      }
      throw new AppError(503, "SMS OTP delivery is not configured. Please contact support.", "SMS_OTP_NOT_CONFIGURED");
    }
  }
}

export async function sendEmailOtp(email: string, otp: string): Promise<SendOtpResult> {
  assertOtpDeliveryConfigured("email");

  const normalizedEmail = email.toLowerCase().trim();
  const hasResend = Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.trim());
  const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  const isDevOrTest = env.NODE_ENV !== "production" || Boolean(env.ALLOW_DEV_OTP);

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>STITCHGRID Verification Code</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 36px 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #4f14e2; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">STITCHGRID</h1>
          <p style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.2px; margin-top: 6px;">Garment Manufacturing Network</p>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 8px;">Hello,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
          Use the 6-digit verification code below to authenticate and access your STITCHGRID account:
        </p>

        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 24px; text-align: center; margin: 28px 0;">
          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0f172a; display: inline-block;">${otp}</span>
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 24px;">
          This code expires in <strong>${env.OTP_TTL_MINUTES} minutes</strong>. For your account security, never share this code with anyone.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

        <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0; text-align: center;">
          If you did not request this verification code, please ignore this email or reach out to STITCHGRID support.
        </p>
      </div>
    </body>
    </html>
  `;

  const emailText = `Your STITCHGRID verification code is: ${otp}\n\nIt expires in ${env.OTP_TTL_MINUTES} minutes. If you did not request this, please ignore this email.`;

  // 1. Primary: Resend Email API over HTTPS (port 443 - never blocked on Render free tier)
  if (hasResend) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM || "STITCHGRID <onboarding@resend.dev>",
          to: [normalizedEmail],
          subject: "Your STITCHGRID verification code",
          text: emailText,
          html: emailHtml,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        console.log(`[RESEND SUCCESS] Verification email delivered to ${normalizedEmail}`);
        return { delivered: true, provider: "resend" };
      }

      // Handle Resend Error Response
      const errorJson = await response.json().catch(() => null) as {
        name?: string;
        message?: string;
        statusCode?: number;
      } | null;

      const message = errorJson?.message || response.statusText;
      const isSandboxRestriction =
        response.status === 403 &&
        (message.toLowerCase().includes("only send testing emails") ||
          message.toLowerCase().includes("verify a domain") ||
          errorJson?.name === "validation_error");

      if (isSandboxRestriction) {
        console.warn(
          `[RESEND SANDBOX RESTRICTION] Recipient "${normalizedEmail}" cannot receive emails from onboarding@resend.dev without a verified domain.`
        );
        console.warn(`[RESEND NOTICE] Provider message: "${message}"`);
        console.info(`[RESEND SANDBOX OTP] Single-use code for ${normalizedEmail}: ${otp}`);

        if (isDevOrTest) {
          return {
            delivered: true,
            provider: "resend_sandbox",
            devOtp: otp,
            sandboxNotice:
              "In Resend sandbox mode, emails only deliver to the account owner's email address. To send to any user, verify a domain at resend.com or use the provided OTP.",
          };
        }

        throw new AppError(
          403,
          `Resend Sandbox Restriction: Free onboarding@resend.dev can only deliver to the account owner's email. To deliver to other recipients, verify a custom domain at resend.com or set ALLOW_DEV_OTP=true on Render. (${message})`,
          "RESEND_DOMAIN_RESTRICTION"
        );
      }

      if (response.status === 401) {
        console.error("[RESEND ERROR] Invalid API key:", message);
        throw new AppError(
          500,
          "Email service authentication failed. Please verify RESEND_API_KEY in Render environment.",
          "EMAIL_AUTH_ERROR"
        );
      }

      if (response.status === 429) {
        console.error("[RESEND RATE LIMIT]", message);
        throw new AppError(
          429,
          "Email delivery rate limit reached. Please wait a minute and try again.",
          "EMAIL_RATE_LIMITED"
        );
      }

      console.error(`[RESEND ERROR] HTTP ${response.status}:`, message);
      throw new AppError(
        502,
        `Email service error: ${message}. Please try again shortly.`,
        "EMAIL_DELIVERY_FAILED"
      );
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error("[RESEND NETWORK ERROR]", err?.message || "Unknown error");
      // Fall through to SMTP if configured, or dev mode
      if (!hasSmtp && !isDevOrTest) {
        throw new AppError(
          502,
          "We could not send the verification email. Please try again shortly.",
          "EMAIL_OTP_DELIVERY_FAILED"
        );
      }
    }
  }

  // 2. Secondary / Legacy Fallback: SMTP (only if SMTP_HOST is explicitly configured)
  if (hasSmtp) {
    try {
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
      });

      await transport.sendMail({
        from: env.SMTP_FROM,
        to: normalizedEmail,
        subject: "Your STITCHGRID verification code",
        text: emailText,
        html: emailHtml,
      });

      console.log(`[SMTP SUCCESS] Verification email delivered to ${normalizedEmail}`);
      return { delivered: true, provider: "smtp" };
    } catch (error: any) {
      console.error(
        "[SMTP ERROR] Delivery failed:",
        error?.message || "Unknown error",
        "(Note: Outbound SMTP ports 587/465 are blocked on Render free tier. Use RESEND_API_KEY to send via HTTPS)."
      );
      if (!isDevOrTest) {
        throw new AppError(
          502,
          "Email delivery failed. Please configure RESEND_API_KEY for HTTPS delivery.",
          "EMAIL_OTP_DELIVERY_FAILED"
        );
      }
    }
  }

  // 3. Development / Sandbox Fallback (if no email provider or during local test)
  if (isDevOrTest) {
    console.info(`[DEV OTP MODE] Verification code for ${normalizedEmail}: ${otp}`);
    return {
      delivered: true,
      provider: "dev_mode",
      devOtp: otp,
      sandboxNotice: "Local/Test mode: OTP code logged and returned for testing.",
    };
  }

  throw new AppError(503, "Email delivery is not configured.", "EMAIL_OTP_NOT_CONFIGURED");
}

export async function sendSmsOtp(phone: string, otp: string): Promise<SendOtpResult> {
  assertOtpDeliveryConfigured("sms");

  let mobile = phone.replace(/[^\d]/g, "");
  if (mobile.length === 10) mobile = `91${mobile}`;
  if (mobile.length < 10 || mobile.length > 15) {
    throw new AppError(400, "Please enter a valid mobile number with country code.", "INVALID_PHONE");
  }

  const isDevOrTest = env.NODE_ENV !== "production" || Boolean(env.ALLOW_DEV_OTP);

  if (!env.SMS_API_KEY || !env.SMS_TEMPLATE_ID) {
    if (isDevOrTest) {
      console.info(`[DEV SMS OTP] Code for ${mobile}: ${otp}`);
      return { delivered: true, provider: "dev_mode", devOtp: otp };
    }
    throw new AppError(503, "SMS OTP delivery is not configured.", "SMS_OTP_NOT_CONFIGURED");
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
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const providerMessage = await response.text();
      console.error("[MSG91 ERROR] Delivery failed:", response.status, providerMessage.slice(0, 300));
      throw new Error("SMS provider rejected the request");
    }

    const result = (await response.json()) as { type?: string; message?: string };
    if (result.type && result.type.toLowerCase() === "error") {
      console.error("[MSG91 ERROR] Delivery rejected:", result.message || "Unknown error");
      throw new Error("SMS provider rejected the request");
    }

    return { delivered: true, provider: "resend" }; // sms provider
  } catch (error) {
    console.error("[MSG91 ERROR] Delivery failed:", error instanceof Error ? error.message : "Unknown error");
    if (isDevOrTest) {
      console.info(`[DEV SMS OTP FALLBACK] Code for ${mobile}: ${otp}`);
      return { delivered: true, provider: "dev_mode", devOtp: otp };
    }
    throw new AppError(502, "We could not send the verification SMS. Please try again shortly.", "SMS_OTP_DELIVERY_FAILED");
  }
}
