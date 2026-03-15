import { getPool } from "../config/postgres.js";

export async function createLoginEvent(data) {
  const pool = getPool();
  if (!pool) return null;
  const { userId, method, at = new Date(), ip, userAgent, device, location } = data;
  const res = await pool.query(
    `INSERT INTO login_events (user_id, method, at, ip, user_agent, device, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [userId ?? null, method, at, ip ?? null, userAgent ?? null, device ?? null, location ? JSON.stringify(location) : null]
  );
  return res.rows[0];
}
