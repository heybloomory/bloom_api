/**
 * Timeline feed cache. Key: timeline:{userId}:{limit}:{offset}, TTL 60 seconds.
 */

import { getCache, setCache } from "./cache.js";

const TTL_SECONDS = 60;

function cacheKey(userId, limit, offset) {
  return `timeline:${userId}:${limit}:${offset}`;
}

/**
 * @param {string} userId
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<Array|null>} Cached memories array or null
 */
export async function getTimelineCache(userId, limit, offset) {
  const key = cacheKey(userId, limit, offset);
  const raw = await getCache(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 * @param {number} limit
 * @param {number} offset
 * @param {Array} data - memories array
 */
export async function setTimelineCache(userId, limit, offset, data) {
  const key = cacheKey(userId, limit, offset);
  await setCache(key, JSON.stringify(data), TTL_SECONDS);
}
