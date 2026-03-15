/**
 * BullMQ worker for media-processing queue.
 * Run as a separate process: npm run worker
 * Placeholder: logs "Processing media job"; future: thumbnails, compression, AI tagging.
 */

import "dotenv/config";
import Redis from "ioredis";
import { Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("REDIS_URL is required to run the media worker. Exiting.");
  process.exit(1);
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "media-processing",
  async (job) => {
    console.log("Processing media job", job.data);
    return { processed: true, mediaId: job.data?.mediaId };
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("error", (err) => console.error("Media worker error:", err));
worker.on("failed", (job, err) => console.warn("Media job failed:", job?.id, err?.message));

console.log("Media worker started");
