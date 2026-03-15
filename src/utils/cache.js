/**
 * Cache utilities using Redis.
 * No-op when Redis is not configured (getCache returns null, setCache/deleteCache do nothing).
 * Do not use from controllers until Redis is integrated.
 */

import { getRedis } from "../config/redis.js";

const DEFAULT_TTL = 300; // seconds

/**
 * @param {string} key
 * @returns {Promise<string|null>} Cached value or null
 */
export async function getCache(key) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlSeconds=DEFAULT_TTL]
 */
export async function setCache(key, value, ttlSeconds = DEFAULT_TTL) {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (ttlSeconds > 0) {
      await redis.setex(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
  } catch {
    // ignore
  }
}

/**
 * @param {string} key
 */
export async function deleteCache(key) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // ignore
  }
}
