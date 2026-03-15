import { getPool } from "../config/postgres.js";
import { rowToMemory } from "./helpers.js";

export async function createMemory(data) {
  const pool = getPool();
  if (!pool) return null;
  const { userId, title, description = "", tags = [], visibility = "private" } = data;
  const res = await pool.query(
    `INSERT INTO memories (user_id, title, description, tags, visibility)
     VALUES ($1, $2, $3, $4::text[], $5)
     RETURNING *`,
    [userId, title, description, tags, visibility]
  );
  return rowToMemory(res.rows[0]);
}

export async function getUserMemories(userId, limit = 200) {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return res.rows.map(rowToMemory);
}

/**
 * Paginated timeline of memories for feed optimization.
 * @param {string} userId
 * @param {number} limit - max results (default 20)
 * @param {number} offset - skip (default 0)
 */
export async function getTimeline(userId, limit = 20, offset = 0) {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset]
  );
  return res.rows.map(rowToMemory);
}

export async function getMemoryById(id, userId) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM memories WHERE id = $1 AND user_id = $2", [id, userId]);
  return rowToMemory(res.rows[0]);
}

export async function updateMemory(id, userId, data) {
  const pool = getPool();
  if (!pool) return null;
  const allowed = ["title", "description", "tags", "visibility", "isFavorite", "coverMediaId"];
  const colMap = { coverMediaId: "cover_media_id", isFavorite: "is_favorite" };
  const setClauses = [];
  const values = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    const col = colMap[k] || k;
    if (allowed.includes(k)) {
      setClauses.push(`${col} = $${i}`);
      values.push(v);
      i++;
    }
  }
  if (setClauses.length === 0) return getMemoryById(id, userId);
  setClauses.push("updated_at = now()");
  values.push(id, userId);
  const res = await pool.query(
    `UPDATE memories SET ${setClauses.join(", ")} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values
  );
  return rowToMemory(res.rows[0]);
}

export async function deleteMemory(id, userId) {
  const pool = getPool();
  if (!pool) return false;
  const res = await pool.query("DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return res.rowCount > 0;
}

/**
 * Full-text search over title and description.
 * @param {string} userId
 * @param {string} query - search phrase
 * @param {number} limit - max results (default 20)
 */
export async function searchMemories(userId, query, limit = 20) {
  const pool = getPool();
  if (!pool || !query || !String(query).trim()) return [];
  const q = String(query).trim();
  const res = await pool.query(
    `SELECT * FROM memories
     WHERE user_id = $1 AND search_vector @@ plainto_tsquery('english', $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, q, limit]
  );
  return res.rows.map(rowToMemory);
}
