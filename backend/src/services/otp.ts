import crypto from "crypto";
import Redis from "ioredis";
import { env } from "../config/env";
import { AppError } from "../utils/http";

const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;
const localOtp = new Map<string, { hash: string; expires: number; attempts: number; sentAt: number }>();
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

export async function issueOtp(destination: string) {
  const key = `otp:${destination.toLowerCase()}`;
  const previous = redis ? await redis.get(`${key}:sent`) : localOtp.get(key)?.sentAt;
  if (previous && Date.now() - Number(previous) < env.OTP_RESEND_SECONDS * 1000) {
    throw new AppError(429, "Please wait before requesting another OTP", "OTP_COOLDOWN");
  }
  const otp = crypto.randomInt(100000, 1000000).toString();
  const record = { hash: hashOtp(otp), expires: Date.now() + env.OTP_TTL_MINUTES * 60_000, attempts: 0, sentAt: Date.now() };
  if (redis) {
    await redis.set(key, JSON.stringify(record), "EX", env.OTP_TTL_MINUTES * 60);
    await redis.set(`${key}:sent`, Date.now().toString(), "EX", env.OTP_RESEND_SECONDS);
  } else localOtp.set(key, record);
  return otp;
}
export async function verifyOtp(destination: string, otp: string) {
  const key = `otp:${destination.toLowerCase()}`;
  const raw = redis ? await redis.get(key) : localOtp.get(key);
  if (!raw) throw new AppError(400, "OTP missing or expired", "OTP_EXPIRED");
  const record = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (record.expires < Date.now()) throw new AppError(400, "OTP expired", "OTP_EXPIRED");
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) throw new AppError(429, "Too many OTP attempts", "OTP_LOCKED");
  if (record.hash !== hashOtp(otp)) {
    record.attempts++;
    if (redis) await redis.set(key, JSON.stringify(record), "EX", Math.max(1, Math.ceil((record.expires - Date.now()) / 1000)));
    else localOtp.set(key, record);
    throw new AppError(400, "Incorrect OTP", "OTP_INVALID");
  }
  if (redis) await redis.del(key); else localOtp.delete(key);
}