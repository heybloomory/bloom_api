#!/usr/bin/env node
/**
 * Apply PostgreSQL migrations using Node (no psql required).
 * Reads DATABASE_URL from .env and runs src/migrations/*.sql in order.
 *
 * Usage: node scripts/runMigrations.js
 */

import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrations = [
  "001_initial.sql",
  "002_indexes.sql",
  "003_media_constraints.sql",
  "004_fulltext_search.sql",
];

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  const config = { connectionString: databaseUrl };
  if (process.env.PGPASSWORD !== undefined) {
    config.password = String(process.env.PGPASSWORD);
  }
  const pool = new pg.Pool(config);
  const client = await pool.connect();

  try {
    for (const name of migrations) {
      const filePath = path.join(__dirname, "..", "src", "migrations", name);
      if (!fs.existsSync(filePath)) {
        console.error("Migration file not found:", filePath);
        process.exit(1);
      }
      const sql = fs.readFileSync(filePath, "utf8");
      console.log("Running", name, "...");
      await client.query(sql);
      console.log("  OK");
    }
    console.log("All migrations applied.");

    const res = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'memories', 'albums', 'media', 'login_events')
      ORDER BY tablename
    `);
    console.log("Tables present:", res.rows.map((r) => r.tablename).join(", "));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
