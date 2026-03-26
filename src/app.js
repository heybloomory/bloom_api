import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import memoryRoutes from "./routes/memories.js";
import albumRoutes from "./routes/albums.js";
import mediaRoutes from "./routes/media.js";
import aiRoutes from "./routes/ai.js";
import searchRoutes from "./routes/search.js";
import timelineRoutes from "./routes/timeline.js";

import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(compression());
// ✅ CORS (Flutter Web + local dev)
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser tools (curl/postman) with no origin
      if (!origin) return cb(null, true);

      // If CORS_ORIGIN="*" allow any origin (reflect origin)
      if (corsOrigin === "*" || corsOrigin === "true") return cb(null, true);

      // Support comma-separated allowlist
      const allow = corsOrigin.split(",").map(s => s.trim()).filter(Boolean);
      if (allow.includes(origin)) return cb(null, true);

      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// ✅ Preflight
app.options("*", cors());

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/user", userRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/timeline", timelineRoutes);

// BloomoryAI Assistant (Ask Me Anything)
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
