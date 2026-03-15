/**
 * Redis connection for future caching and WebSocket scaling.
 * Not connected at startup if REDIS_URL is not set.
 *
 * Env: REDIS_URL (e.g. redis://localhost:6379)
 */

import Redis from "ioredis";

let redis = null;

export function getRedis() {
  return redis;
}

export function connectRedis() {
  const url = process.env.REDIS_URL;
  if (!url || !url.trim()) {
    console.log("Redis not configured");
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redis.on("error", (err) => console.error("Redis error:", err.message));
    redis.on("connect", () => console.log("✅ Redis connected"));
    return redis;
  } catch (e) {
    console.warn("⚠️  Redis connection failed:", e.message);
    return null;
  }
}

export async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log("Redis connection closed");
  }
}
