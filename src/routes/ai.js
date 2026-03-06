import express from "express";

const router = express.Router();

// Simple in-memory rate limit (per IP) to keep costs controlled.
// Defaults: 30 requests / 15 minutes.
const WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MS || 15 * 60 * 1000);
const MAX_REQ = Number(process.env.AI_RATE_MAX || 30);
const hits = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
  const rec = hits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + WINDOW_MS;
  }
  rec.count += 1;
  hits.set(ip, rec);

  if (rec.count > MAX_REQ) {
    const retryAfter = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      reply:
        "You’re sending too many requests right now. Please wait a bit and try again.",
    });
  }
  next();
}

function looksLikeCodeRequest(text) {
  const t = (text || "").toLowerCase();
  const patterns = [
    "write code",
    "give code",
    "flutter",
    "dart",
    "node",
    "express",
    "mongodb",
    "mongoose",
    "error",
    "stack trace",
    "stacktrace",
    "exception",
    "compile",
    "build failed",
    "npm",
    "pub get",
    "gradle",
    "xcode",
    "api key",
    "function",
    "class ",
    "import ",
    "package ",
    "```",
  ];
  return patterns.some((p) => t.includes(p));
}

async function callOpenAI({ input }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing in .env");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS || 300);

  // 1) Moderation (block abusive/unsafe content)
  const modResp = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input }),
  });

  if (!modResp.ok) {
    const txt = await modResp.text();
    throw new Error(`Moderation failed: ${modResp.status} ${txt}`);
  }
  const modJson = await modResp.json();
  const flagged = Boolean(modJson?.results?.[0]?.flagged);
  if (flagged) {
    return {
      reply:
        "I can’t help with that. Please ask something respectful and safe (for example: organizing memories, BloomoryAI features, privacy, or using the app).",
    };
  }

  // 2) Chat generation (Responses API)
  const system =
    "You are BloomoryAI Assistant. You help users with BloomoryAI product questions, features (duplicate detection, best photo selection, auto tagging, auto organization, enhancement, filters), pricing concepts, privacy, and how to use the app.\n" +
    "Rules:\n" +
    "- Do NOT provide programming/code help, code snippets, debugging steps, or developer instructions.\n" +
    "- If the user asks for code or technical implementation, politely refuse and provide a non-technical explanation.\n" +
    "- Keep answers concise, friendly, and practical.";

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_output_tokens: maxOutputTokens,
      input: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI failed: ${resp.status} ${txt}`);
  }

  const json = await resp.json();
  // Extract text from Responses API output
  const parts = json?.output?.flatMap((o) => o?.content || []) || [];
  const text =
    parts
      .filter((c) => c?.type === "output_text")
      .map((c) => c?.text)
      .join("\n") ||
    "";

  return { reply: text.trim() || "Sorry, I couldn’t generate a reply." };
}

router.post("/ask", rateLimit, async (req, res, next) => {
  try {
    const message = (req.body?.message || "").toString().trim();
    if (!message) {
      return res.status(400).json({ reply: "Please type a question." });
    }

    // Enforce: no code / no dev debugging help
    if (looksLikeCodeRequest(message)) {
      return res.json({
        reply:
          "I can’t help with coding or debugging. But I can explain BloomoryAI features in simple terms and how you can use them in the app. What are you trying to do?",
      });
    }

    const out = await callOpenAI({ input: message });
    return res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
