import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { connectPostgres } from "./config/postgres.js";
import { connectRedis, getRedis } from "./config/redis.js";
import { attachChatServer } from "./websocket/chatServer.js";

const PORT = process.env.PORT || 4000;

async function boot() {
  // MongoDB (existing primary until migration complete)
  const skipDb = String(process.env.SKIP_DB || "").toLowerCase() === "true";
  if (!skipDb) {
    try {
      await connectDB();
    } catch (e) {
      console.error(
        "⚠️  MongoDB connection failed. Starting server anyway (set SKIP_DB=true to silence this).\n",
        e
      );
    }
  } else {
    console.log("ℹ️  SKIP_DB=true → skipping MongoDB connection");
  }

  // PostgreSQL (optional; for migration and new features: chat, AI history)
  await connectPostgres();

  // Redis (cache, BullMQ, timeline, WebSocket scaling)
  connectRedis();
  if (!getRedis()) console.log("Redis not configured");

  const httpServer = http.createServer(app);
  attachChatServer(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 bloom_api listening on http://0.0.0.0:${PORT}`);
    console.log(`Server running on port ${PORT}`);
  });
}

boot().catch((e) => {
  console.error("❌ Boot failed:", e);
  process.exit(1);
});
