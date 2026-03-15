/**
 * WebSocket chat server skeleton.
 * Attaches to the same HTTP server as Express so chat runs on the same port.
 * Messages are stored in PostgreSQL (conversations, messages tables).
 *
 * Env: DATABASE_URL must be set for persistence. If PostgreSQL is not connected,
 * messages are not stored (skeleton still runs for connection testing).
 */

import { WebSocketServer } from "ws";
import { getPool } from "../config/postgres.js";

/**
 * Attach WebSocket server to the existing HTTP server.
 * @param {import("http").Server} httpServer - Node HTTP server (Express app)
 */
export function attachChatServer(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws/chat",
  });

  wss.on("connection", (ws, req) => {
    const url = req.url || "";
    // Optional: parse token from query, e.g. /ws/chat?token=JWT
    let userId = null;
    const tokenMatch = /[?&]token=([^&]+)/.exec(url);
    if (tokenMatch) {
      // In a full implementation, verify JWT and set userId
      userId = tokenMatch[1];
    }

    ws.on("message", async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const { type, conversationId, text } = payload;

        if (type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (type === "message" && text) {
          const pool = getPool();
          if (pool && userId) {
            // Persist to PostgreSQL: ensure conversation exists, insert message
            // Skeleton: we would resolve conversationId (or create), insert into messages
            const client = await pool.connect();
            try {
              let convId = conversationId;
              if (!convId) {
                const createConv = await client.query(
                  "INSERT INTO conversations DEFAULT VALUES RETURNING id"
                );
                convId = createConv.rows[0].id;
                // Add participant: INSERT INTO conversation_participants (conversation_id, user_id) ...
              }
              // Parse userId if it was JWT (for now assume it's placeholder)
              // await client.query(
              //   'INSERT INTO messages (conversation_id, sender_id, text, type) VALUES ($1, $2, $3, $4)',
              //   [convId, userId, text, 'text']
              // );
            } finally {
              client.release();
            }
          }
          ws.send(JSON.stringify({ type: "message_sent", text: text.slice(0, 200) }));
          return;
        }

        ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", message: e.message || "Invalid payload" }));
      }
    });

    ws.send(JSON.stringify({ type: "connected", message: "Chat WebSocket ready" }));
  });

  wss.on("listening", () => {
    console.log("✅ WebSocket chat server attached at path /ws/chat");
  });

  return wss;
}
