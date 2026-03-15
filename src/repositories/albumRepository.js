import { getPool } from "../config/postgres.js";
import { rowToAlbum } from "./helpers.js";

export async function createAlbum(data) {
  const pool = getPool();
  if (!pool) return null;
  const { userId, memoryId, parentId, level, title, description = "", coverMediaId } = data;
  const res = await pool.query(
    `INSERT INTO albums (user_id, memory_id, parent_id, level, title, description, cover_media_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, memoryId ?? null, parentId ?? null, level ?? 1, title, description, coverMediaId ?? null]
  );
  return rowToAlbum(res.rows[0]);
}

/**
 * Get albums for a user with optional filters (memory_id, parent_id).
 * Results ordered by created_at ASC.
 */
export async function getAlbumsByUser(userId, filters = {}) {
  const pool = getPool();
  if (!pool) return [];
  const { memoryId, parentId } = filters;
  let query = "SELECT * FROM albums WHERE user_id = $1";
  const values = [userId];
  let i = 2;
  if (memoryId !== undefined && memoryId !== null && memoryId !== "") {
    query += ` AND memory_id = $${i}`;
    values.push(memoryId);
    i++;
  }
  if (parentId !== undefined) {
    if (parentId === null || parentId === "" || parentId === "null") {
      query += " AND parent_id IS NULL";
    } else {
      query += ` AND parent_id = $${i}`;
      values.push(parentId);
      i++;
    }
  } else {
    query += " AND parent_id IS NULL";
  }
  query += ` ORDER BY created_at ASC LIMIT $${i}`;
  values.push(200);
  const res = await pool.query(query, values);
  return res.rows.map(rowToAlbum);
}

export async function getAlbumById(id, userId) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM albums WHERE id = $1 AND user_id = $2", [id, userId]);
  return rowToAlbum(res.rows[0]);
}

export async function getChildAlbums(parentId, userId, limit = 200) {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT * FROM albums WHERE parent_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3",
    [parentId, userId, limit]
  );
  return res.rows.map(rowToAlbum);
}

export async function countChildAlbums(parentId, userId) {
  const pool = getPool();
  if (!pool) return 0;
  const res = await pool.query(
    "SELECT COUNT(*)::int AS c FROM albums WHERE parent_id = $1 AND user_id = $2",
    [parentId, userId]
  );
  return res.rows[0]?.c ?? 0;
}

export async function updateAlbum(id, userId, data) {
  const pool = getPool();
  if (!pool) return null;
  const allowed = ["title", "description", "memoryId", "coverMediaId"];
  const colMap = { memoryId: "memory_id", coverMediaId: "cover_media_id" };
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
  if (setClauses.length === 0) return getAlbumById(id, userId);
  setClauses.push("updated_at = now()");
  values.push(id, userId);
  const res = await pool.query(
    `UPDATE albums SET ${setClauses.join(", ")} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values
  );
  return rowToAlbum(res.rows[0]);
}

export async function deleteAlbum(id, userId) {
  const pool = getPool();
  if (!pool) return false;
  const res = await pool.query("DELETE FROM albums WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return res.rowCount > 0;
}

/**
 * Full-text search over title and description.
 * @param {string} userId
 * @param {string} query - search phrase
 * @param {number} limit - max results (default 20)
 */
export async function searchAlbums(userId, query, limit = 20) {
  const pool = getPool();
  if (!pool || !query || !String(query).trim()) return [];
  const q = String(query).trim();
  const res = await pool.query(
    `SELECT * FROM albums
     WHERE user_id = $1 AND search_vector @@ plainto_tsquery('english', $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, q, limit]
  );
  return res.rows.map(rowToAlbum);
}
