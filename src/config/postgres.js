/**
 * PostgreSQL connection pool for BloomoryAI backend.
 * Used alongside MongoDB during migration; eventually becomes primary DB.
 *
 * Required env:
 *   DATABASE_URL - e.g. postgresql://user:password@localhost:5432/bloomory
 * Optional:
 *   SKIP_PG=true - skip connecting to PostgreSQL (e.g. local dev without PG)
 */

import pg from "pg";

const { Pool } = pg;

let pool = null;

export function getPool() {
  return pool;
}

export async function connectPostgres() {
  const skip = String(process.env.SKIP_PG || "").toLowerCase() === "true";
  if (skip) {
    console.log("ℹ️  SKIP_PG=true → skipping PostgreSQL connection");
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("⚠️  DATABASE_URL not set → PostgreSQL not connected");
    return null;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("PostgreSQL pool error:", err.message);
  });

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✅ PostgreSQL connected");
    return pool;
  } catch (e) {
    console.error("⚠️  PostgreSQL connection failed:", e.message);
    pool = null;
    return null;
  }
}

export async function closePostgres() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("PostgreSQL pool closed");
  }
}
