#!/usr/bin/env node
/**
 * Compare record counts: MongoDB vs PostgreSQL.
 * Use after running migrateMongoToPostgres.js to verify data parity.
 *
 * Usage: node scripts/verifyMigration.js
 * Env: MONGO_URI, DATABASE_URL must be set.
 */

import "dotenv/config";
import mongoose from "mongoose";
import pg from "pg";

async function run() {
  const mongoUri = process.env.MONGO_URI;
  const databaseUrl = process.env.DATABASE_URL;
  if (!mongoUri || !databaseUrl) {
    console.error("Set MONGO_URI and DATABASE_URL");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  const results = { users: {}, memories: {}, albums: {}, media: {} };
  const mismatches = [];

  try {
    const mongoCount = (coll) => mongoose.connection.collection(coll).countDocuments();

    const [mUsers, mMemories, mAlbums, mMedia] = await Promise.all([
      mongoCount("users"),
      mongoCount("memories"),
      mongoCount("albums"),
      mongoCount("media"),
    ]);

    const pUsers = (await client.query("SELECT COUNT(*)::int AS c FROM users")).rows[0].c;
    const pMemories = (await client.query("SELECT COUNT(*)::int AS c FROM memories")).rows[0].c;
    const pAlbums = (await client.query("SELECT COUNT(*)::int AS c FROM albums")).rows[0].c;
    const pMedia = (await client.query("SELECT COUNT(*)::int AS c FROM media")).rows[0].c;

    results.users = { mongo: mUsers, postgres: pUsers };
    results.memories = { mongo: mMemories, postgres: pMemories };
    results.albums = { mongo: mAlbums, postgres: pAlbums };
    results.media = { mongo: mMedia, postgres: pMedia };

    if (mUsers !== pUsers) mismatches.push("users");
    if (mMemories !== pMemories) mismatches.push("memories");
    if (mAlbums !== pAlbums) mismatches.push("albums");
    if (mMedia !== pMedia) mismatches.push("media");

    console.log("Count comparison (MongoDB vs PostgreSQL):");
    console.log("  users:    ", mUsers, " vs ", pUsers, mUsers === pUsers ? " OK" : " MISMATCH");
    console.log("  memories: ", mMemories, " vs ", pMemories, mMemories === pMemories ? " OK" : " MISMATCH");
    console.log("  albums:   ", mAlbums, " vs ", pAlbums, mAlbums === pAlbums ? " OK" : " MISMATCH");
    console.log("  media:    ", mMedia, " vs ", pMedia, mMedia === pMedia ? " OK" : " MISMATCH");

    if (mismatches.length > 0) {
      console.log("\nMismatches:", mismatches.join(", "));
      process.exit(1);
    }
    console.log("\nAll counts match.");
  } finally {
    client.release();
    await pool.end();
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
