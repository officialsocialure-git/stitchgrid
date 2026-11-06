import crypto from "crypto";
import Redis from "ioredis";
import { env } from "../config/env";
import { AppError } from "../utils/http";

const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;
const localOtp = new Map<string, { hash: string; plainOtp?: string; expires: number; attempts: number; sentAt: number }>();
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

export interface IssueOtpResult {
  otp: string;
  isExisting: boolean;
  cooldownRemaining: number;
}

export async function issueOtp(
  destination: string,
  options: { allowExisting?: boolean } = {}
): Promise<IssueOtpResult> {
  const key = `otp:${destination.toLowerCase().trim()}`;
  const now = Date.now();
  const cooldownMs = env.OTP_RESEND_SECONDS * 1000;

  // Retrieve any existing active record
  const rawRecord = redis ? await redis.get(key) : localOtp.get(key);
  const existingRecord = rawRecord
    ? typeof rawRecord === "string"
      ? JSON.parse(rawRecord)
      : rawRecord
    : null;

  const previousSent = redis ? await redis.get(`${key}:sent`) : localOtp.get(key)?.sentAt;
  const elapsed = previousSent ? now - Number(previousSent) : Infinity;
  const inCooldown = elapsed < cooldownMs;
  const cooldownRemaining = inCooldown ? Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000)) : 0;

  // Case 1: An active, unexpired OTP already exists and allowExisting is true (e.g. user submitting valid login credentials)
  if (
    options.allowExisting &&
    existingRecord &&
    existingRecord.expires > now &&
    existingRecord.attempts < env.OTP_MAX_ATTEMPTS &&
    inCooldown
  ) {
    return {
      otp: existingRecord.plainOtp || "",
      isExisting: true,
      cooldownRemaining,
    };
  }

  // Case 2: In cooldown and allowExisting is false (e.g. explicit resend request)
  if (inCooldown && !options.allowExisting) {
    throw new AppError(
      429,
      `Please wait ${cooldownRemaining}s before requesting another OTP`,
      "OTP_COOLDOWN"
    );
  }

  // Case 3: Issue a fresh 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  // Keep plaintext OTP accessible in memory when SMTP is not configured or in non-production, ensuring users are never blocked
  const shouldStorePlain = !env.SMTP_HOST || env.NODE_ENV !== "production";
  const record = {
    hash: hashOtp(otp),
    plainOtp: shouldStorePlain ? otp : undefined,
    expires: now + env.OTP_TTL_MINUTES * 60_000,
    attempts: 0,
    sentAt: now,
  };

  if (redis) {
    await redis.set(key, JSON.stringify(record), "EX", env.OTP_TTL_MINUTES * 60);
    await redis.set(`${key}:sent`, now.toString(), "EX", env.OTP_RESEND_SECONDS);
  } else {
    localOtp.set(key, record);
  }

  return {
    otp,
    isExisting: false,
    cooldownRemaining: env.OTP_RESEND_SECONDS,
  };
}

export async function verifyOtp(destination: string, otp: string) {
  const key = `otp:${destination.toLowerCase().trim()}`;
  const raw = redis ? await redis.get(key) : localOtp.get(key);
  if (!raw) throw new AppError(400, "OTP missing or expired", "OTP_EXPIRED");
  const record = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (record.expires < Date.now()) throw new AppError(400, "OTP expired", "OTP_EXPIRED");
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) throw new AppError(429, "Too many failed OTP attempts. Please request a new code.", "OTP_LOCKED");
  if (record.hash !== hashOtp(otp)) {
    record.attempts++;
    if (redis) await redis.set(key, JSON.stringify(record), "EX", Math.max(1, Math.ceil((record.expires - Date.now()) / 1000)));
    else localOtp.set(key, record);
    throw new AppError(400, "Incorrect 6-digit OTP code", "OTP_INVALID");
  }
  if (redis) {
    await redis.del(key);
    await redis.del(`${key}:sent`);
  } else {
    localOtp.delete(key);
  }
}
