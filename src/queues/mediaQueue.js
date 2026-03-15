/**
 * BullMQ queue for background media processing (thumbnails, compression, AI tagging).
 * Only created when REDIS_URL is set.
 */

import Redis from "ioredis";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;
let mediaQueue = null;

if (redisUrl) {
  try {
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    mediaQueue = new Queue("media-processing", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
      },
    });
  } catch (e) {
    console.warn("Media queue init failed:", e.message);
  }
}

export function getMediaQueue() {
  return mediaQueue;
}

/**
 * Add a media processing job (non-blocking; safe when queue is unavailable).
 * @param {{ mediaId: string, type: string }} data
 */
export async function addMediaJob(data) {
  const queue = getMediaQueue();
  if (!queue) return null;
  try {
    const job = await queue.add("process-media", data, {
      jobId: data.mediaId ? `media-${data.mediaId}` : undefined,
    });
    return job;
  } catch (e) {
    console.warn("Media queue add failed:", e.message);
    return null;
  }
}
