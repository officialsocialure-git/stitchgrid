import crypto from "crypto";
import Redis from "ioredis";
import { env } from "../config/env";
import { AppError } from "../utils/http";

let redis: Redis | null = null;

if (env.REDIS_URL && env.REDIS_URL.trim()) {
  try {
    redis = new Redis(env.REDIS_URL.trim(), {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 5) return null; // stop retry loop after 5 attempts, memory fallback takes over
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    redis.on("connect", () => {
      console.log("[REDIS] Successfully connected to Redis OTP store");
    });

    redis.on("error", (err) => {
      console.error("[REDIS ERROR]", err.message);
    });
  } catch (err: any) {
    console.error("[REDIS INIT ERROR] Failed to instantiate Redis client:", err?.message);
    redis = null;
  }
}

const localOtp = new Map<string, { hash: string; expires: number; attempts: number; sentAt: number }>();
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

async function getStoredRecord(key: string): Promise<{ hash: string; expires: number; attempts: number; sentAt: number } | null> {
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (err: any) {
      console.warn("[REDIS GET ERROR - USING MEMORY]", err.message);
    }
  }
  return localOtp.get(key) || null;
}

async function getStoredSentTime(key: string): Promise<number | null> {
  if (redis) {
    try {
      const sent = await redis.get(`${key}:sent`);
      if (sent) return Number(sent);
    } catch (err: any) {
      console.warn("[REDIS SENT TIME ERROR - USING MEMORY]", err.message);
    }
  }
  const mem = localOtp.get(key);
  return mem ? mem.sentAt : null;
}

async function saveRecord(key: string, record: { hash: string; expires: number; attempts: number; sentAt: number }, ttlSeconds: number) {
  localOtp.set(key, record);
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(record), "EX", ttlSeconds);
      await redis.set(`${key}:sent`, record.sentAt.toString(), "EX", env.OTP_RESEND_SECONDS);
    } catch (err: any) {
      console.warn("[REDIS SET ERROR - STORED IN MEMORY]", err.message);
    }
  }
}

async function removeRecord(key: string) {
  localOtp.delete(key);
  if (redis) {
    try {
      await redis.del(key);
      await redis.del(`${key}:sent`);
    } catch (err: any) {
      console.warn("[REDIS DEL ERROR]", err.message);
    }
  }
}

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
  const existingRecord = await getStoredRecord(key);
  const previousSent = await getStoredSentTime(key);
  const elapsed = previousSent ? now - previousSent : Infinity;
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
      otp: "",
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
  const record = {
    hash: hashOtp(otp),
    expires: now + env.OTP_TTL_MINUTES * 60_000,
    attempts: 0,
    sentAt: now,
  };

  await saveRecord(key, record, env.OTP_TTL_MINUTES * 60);

  return {
    otp,
    isExisting: false,
    cooldownRemaining: env.OTP_RESEND_SECONDS,
  };
}

export async function invalidateOtp(destination: string) {
  const key = `otp:${destination.toLowerCase().trim()}`;
  await removeRecord(key);
}

export async function verifyOtp(destination: string, otp: string) {
  const key = `otp:${destination.toLowerCase().trim()}`;
  const record = await getStoredRecord(key);

  if (!record) {
    throw new AppError(400, "OTP missing or expired. Please request a new code.", "OTP_EXPIRED");
  }

  if (record.expires < Date.now()) {
    await removeRecord(key);
    throw new AppError(400, "OTP expired. Please request a new code.", "OTP_EXPIRED");
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    await removeRecord(key);
    throw new AppError(429, "Too many failed OTP attempts. Please request a new code.", "OTP_LOCKED");
  }

  if (record.hash !== hashOtp(otp.trim())) {
    record.attempts++;
    const ttlSeconds = Math.max(1, Math.ceil((record.expires - Date.now()) / 1000));
    await saveRecord(key, record, ttlSeconds);
    const remaining = env.OTP_MAX_ATTEMPTS - record.attempts;
    throw new AppError(
      400,
      `Incorrect 6-digit OTP code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Please request a new code."}`,
      "OTP_INVALID"
    );
  }

  // Code verified successfully: invalidate immediately to prevent replay attacks
  await removeRecord(key);
}
