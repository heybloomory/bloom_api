#!/usr/bin/env node
/**
 * One-time migration: MongoDB → PostgreSQL.
 * Reads users, memories, albums, media, login_events from MongoDB;
 * maps ObjectIds to UUIDs; inserts into PostgreSQL in dependency order.
 *
 * Usage: node scripts/migrateMongoToPostgres.js
 * Env: MONGO_URI, DATABASE_URL must be set.
 */

import "dotenv/config";
import mongoose from "mongoose";
import pg from "pg";
import { randomUUID } from "crypto";

const BATCH = 100;

function mapId(mongoId, idMap) {
  if (!mongoId) return null;
  const s = mongoId.toString();
  return idMap.get(s) ?? null;
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  const databaseUrl = process.env.DATABASE_URL;
  if (!mongoUri || !databaseUrl) {
    console.error("Set MONGO_URI and DATABASE_URL");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  console.log("PostgreSQL connected");

  const userMap = new Map();   // mongo _id -> uuid
  const memoryMap = new Map();
  const albumMap = new Map();
  const mediaMap = new Map();

  try {
    // 1) Users
    const User = mongoose.connection.collection("users");
    const users = await User.find({}).toArray();
    console.log(`Users: ${users.length}`);
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      for (const u of batch) {
        const id = randomUUID();
        userMap.set(u._id.toString(), id);
        await client.query(
          `INSERT INTO users (id, email, phone, name, password_hash, plan, avatar_url, last_login_at, last_login_ip, last_login_device, last_login_location, providers, is_email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            id,
            u.email ?? null,
            u.phone ?? null,
            u.name ?? "",
            u.passwordHash ?? null,
            u.plan ?? "free",
            u.avatarUrl ?? "",
            u.lastLoginAt ?? null,
            u.lastLoginIP ?? null,
            u.lastLoginDevice ?? null,
            u.lastLoginLocation ? JSON.stringify(u.lastLoginLocation) : null,
            u.providers ? JSON.stringify(u.providers) : "{}",
            u.isEmailVerified ?? false,
            u.createdAt ?? new Date(),
            u.updatedAt ?? new Date(),
          ]
        );
      }
      console.log(`  users ${i + batch.length}/${users.length}`);
    }

    // 2) Memories (no cover_media_id yet)
    const Memory = mongoose.connection.collection("memories");
    const memories = await Memory.find({}).toArray();
    console.log(`Memories: ${memories.length}`);
    for (let i = 0; i < memories.length; i += BATCH) {
      const batch = memories.slice(i, i + BATCH);
      for (const m of batch) {
        const uid = mapId(m.userId, userMap);
        if (!uid) continue;
        const id = randomUUID();
        memoryMap.set(m._id.toString(), id);
        await client.query(
          `INSERT INTO memories (id, user_id, title, description, tags, is_favorite, visibility, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            id,
            uid,
            m.title ?? "",
            m.description ?? "",
            m.tags ?? [],
            m.isFavorite ?? false,
            m.visibility ?? "private",
            m.createdAt ?? new Date(),
            m.updatedAt ?? new Date(),
          ]
        );
      }
      console.log(`  memories ${i + batch.length}/${memories.length}`);
    }

    // 3) Albums (root first, then by level so parent_id exists)
    const Album = mongoose.connection.collection("albums");
    const albumsRaw = await Album.find({}).toArray();
    const byLevel = [[], [], []];
    for (const a of albumsRaw) {
      const l = (a.level ?? 1) - 1;
      if (l >= 0 && l <= 2) byLevel[l].push(a);
    }
    const albumsOrdered = [...byLevel[0], ...byLevel[1], ...byLevel[2]];
    console.log(`Albums: ${albumsOrdered.length}`);
    for (let i = 0; i < albumsOrdered.length; i += BATCH) {
      const batch = albumsOrdered.slice(i, i + BATCH);
      for (const a of batch) {
        const uid = mapId(a.userId, userMap);
        if (!uid) continue;
        const mid = mapId(a.memoryId, memoryMap);
        const pid = mapId(a.parentId, albumMap);
        const id = randomUUID();
        albumMap.set(a._id.toString(), id);
        await client.query(
          `INSERT INTO albums (id, user_id, memory_id, parent_id, level, title, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            id,
            uid,
            mid,
            pid,
            Math.min(3, Math.max(1, a.level ?? 1)),
            a.title ?? "",
            a.description ?? "",
            a.createdAt ?? new Date(),
            a.updatedAt ?? new Date(),
          ]
        );
      }
      console.log(`  albums ${i + batch.length}/${albumsOrdered.length}`);
    }

    // 4) Media
    const Media = mongoose.connection.collection("media");
    const media = await Media.find({}).toArray();
    console.log(`Media: ${media.length}`);
    for (let i = 0; i < media.length; i += BATCH) {
      const batch = media.slice(i, i + BATCH);
      for (const m of batch) {
        const uid = mapId(m.userId, userMap);
        if (!uid) continue;
        const mid = mapId(m.memoryId, memoryMap);
        const aid = mapId(m.albumId, albumMap);
        const id = randomUUID();
        mediaMap.set(m._id.toString(), id);
        const type = m.type === "video" ? "video" : "image";
        const url = type === "image"
          ? (m.url && String(m.url).trim() ? m.url : "https://placeholder.local/migrated-image")
          : (m.url ?? null);
        const videoId = type === "video" ? (m.videoId ?? m.url ?? "") : null;
        await client.query(
          `INSERT INTO media (id, user_id, memory_id, album_id, type, url, thumbnail_url, video_id, size_bytes, width, height, mime_type, duration_sec, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            id,
            uid,
            mid,
            aid,
            type,
            url,
            m.thumbUrl ?? "",
            videoId,
            m.sizeBytes ?? null,
            m.width ?? null,
            m.height ?? null,
            m.mimeType ?? "",
            m.durationSec ?? null,
            m.createdAt ?? new Date(),
            m.updatedAt ?? new Date(),
          ]
        );
      }
      console.log(`  media ${i + batch.length}/${media.length}`);
    }

    // 5) Backfill cover_media_id on memories and albums
    for (const m of memories) {
      const cid = mapId(m.coverMediaId, mediaMap);
      if (cid) {
        const mid = memoryMap.get(m._id.toString());
        if (mid) await client.query("UPDATE memories SET cover_media_id = $1 WHERE id = $2", [cid, mid]);
      }
    }
    for (const a of albumsOrdered) {
      const cid = mapId(a.coverMediaId, mediaMap);
      if (cid) {
        const aid = albumMap.get(a._id.toString());
        if (aid) await client.query("UPDATE albums SET cover_media_id = $1 WHERE id = $2", [cid, aid]);
      }
    }
    console.log("Cover media backfilled");

    // 6) Login events
    const LoginEvent = mongoose.connection.collection("loginevents");
    let loginEvents = [];
    try {
      loginEvents = await LoginEvent.find({}).toArray();
    } catch {
      try {
        loginEvents = await mongoose.connection.collection("login_events").find({}).toArray();
      } catch {}
    }
    console.log(`Login events: ${loginEvents.length}`);
    for (let i = 0; i < loginEvents.length; i += BATCH) {
      const batch = loginEvents.slice(i, i + BATCH);
      for (const e of batch) {
        const uid = mapId(e.userId, userMap);
        await client.query(
          `INSERT INTO login_events (user_id, method, at, ip, user_agent, device, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            uid,
            e.method ?? "password",
            e.at ?? e.createdAt ?? new Date(),
            e.ip ?? null,
            e.userAgent ?? null,
            e.device ?? null,
            e.location ? JSON.stringify(e.location) : null,
          ]
        );
      }
      console.log(`  login_events ${i + batch.length}/${loginEvents.length}`);
    }

    console.log("Migration completed.");
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
