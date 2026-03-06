import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

async function boot() {
  // Allow running the API without MongoDB for local dev / AI-only testing.
  // Set SKIP_DB=true in .env to bypass DB connection.
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 bloom_api listening on http://0.0.0.0:${PORT}`);
  });
}

boot().catch((e) => {
  console.error("❌ Boot failed:", e);
  process.exit(1);
});
