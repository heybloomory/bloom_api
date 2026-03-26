import { getPool } from "../config/postgres.js";
import { rowToMedia } from "./helpers.js";

export async function createMedia(data) {
  const pool = getPool();
  if (!pool) return null;
  const {
    userId,
    albumId,
    memoryId,
    type,
    url = "",
    videoId = "",
    key = "",
    originalFileName = "",
    thumbnailUrl = "",
    sizeBytes,
    width,
    height,
    mimeType = "",
    durationSec,
  } = data;
  const res = await pool.query(
    `INSERT INTO media (user_id, album_id, memory_id, type, url, video_id, storage_key, original_file_name, thumbnail_url, size_bytes, width, height, mime_type, duration_sec)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      userId,
      albumId ?? null,
      memoryId ?? null,
      type,
      type === "video" ? (url || null) : url,
      type === "video" ? (videoId || null) : null,
      key || null,
      originalFileName || null,
      thumbnailUrl,
      sizeBytes ?? null,
      width ?? null,
      height ?? null,
      mimeType,
      durationSec ?? null,
    ]
  );
  return rowToMedia(res.rows[0]);
}

/**
 * Get media for a user with optional filters and pagination.
 * @param {string} userId
 * @param {object} filters - { albumId?, memoryId? }
 * @param {number} limit - max rows (default 500)
 * @param {number} offset - skip N rows (default 0)
 */
export async function getMediaByUser(userId, filters = {}, limit = 500, offset = 0) {
  const pool = getPool();
  if (!pool) return [];
  let query = "SELECT * FROM media WHERE user_id = $1";
  const values = [userId];
  let i = 2;
  if (filters.albumId) {
    query += ` AND album_id = $${i}`;
    values.push(filters.albumId);
    i++;
  }
  if (filters.memoryId) {
    query += ` AND memory_id = $${i}`;
    values.push(filters.memoryId);
    i++;
  }
  query += ` ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`;
  values.push(limit, offset);
  const res = await pool.query(query, values);
  return res.rows.map(rowToMedia);
}

export async function getMediaByAlbum(albumId, userId, limit = 500) {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT * FROM media WHERE album_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3",
    [albumId, userId, limit]
  );
  return res.rows.map(rowToMedia);
}

export async function getMediaById(id, userId) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM media WHERE id = $1 AND user_id = $2", [id, userId]);
  return rowToMedia(res.rows[0]);
}

export async function deleteMedia(id, userId) {
  const pool = getPool();
  if (!pool) return false;
  const res = await pool.query("DELETE FROM media WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return res.rowCount > 0;
}

export async function deleteMediaByAlbumId(albumId, userId) {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM media WHERE album_id = $1 AND user_id = $2", [albumId, userId]);
}
