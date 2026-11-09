import Redis from "ioredis";
import { env } from "../config/env";

let redis: Redis | null = null;

if (env.REDIS_URL && env.REDIS_URL.trim()) {
  try {
    redis = new Redis(env.REDIS_URL.trim(), {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 5) return null; // fallback to memory
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    redis.on("connect", () => {
      console.log("[CACHE] Successfully connected to Redis Cache");
    });

    redis.on("error", (err) => {
      console.warn("[CACHE WARNING] Redis Cache error:", err.message);
    });
  } catch (err: any) {
    console.warn("[CACHE INIT] Redis unavailable, using memory cache fallback:", err.message);
    redis = null;
  }
}

// In-memory fallback cache with TTL
const localCache = new Map<string, { data: any; expiresAt: number }>();

export async function getCache<T>(key: string): Promise<T | null> {
  const now = Date.now();

  // Try Redis first
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch (err: any) {
      console.warn(`[CACHE GET FAILED: ${key}]`, err.message);
    }
  }

  // Memory fallback
  const mem = localCache.get(key);
  if (mem) {
    if (mem.expiresAt > now) {
      return mem.data as T;
    }
    localCache.delete(key);
  }

  return null;
}

export async function setCache(key: string, data: any, ttlSeconds: number = 60): Promise<void> {
  const now = Date.now();
  localCache.set(key, { data, expiresAt: now + ttlSeconds * 1000 });

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch (err: any) {
      console.warn(`[CACHE SET FAILED: ${key}]`, err.message);
    }
  }
}

export async function invalidateCachePattern(prefix: string): Promise<void> {
  // Clear memory keys matching prefix
  for (const k of localCache.keys()) {
    if (k.startsWith(prefix)) {
      localCache.delete(k);
    }
  }

  // Clear Redis keys matching prefix
  if (redis) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err: any) {
      console.warn(`[CACHE INVALIDATE FAILED: ${prefix}]`, err.message);
    }
  }
}

