# Migration Strategy: MongoDB → PostgreSQL

This document describes how to move BloomoryAI backend from MongoDB (primary) to PostgreSQL without breaking the existing Flutter frontend.

## Current State (After Step 1–6 Implementation)

- **MongoDB**: Still the primary database. All existing routes (auth, users, memories, albums, media) read/write via Mongoose.
- **PostgreSQL**: Optional. Used for:
  - **AI**: `ai_conversations`, `ai_messages` (when `DATABASE_URL` is set and user is authenticated).
  - **Chat**: `conversations`, `messages`, `conversation_participants` (WebSocket skeleton; full persistence to be wired when chat moves off Firestore).
- **Media**: Images → Bunny Storage (unchanged). Videos → Bunny Stream (new); `videoId` and playback URL stored in MongoDB Media docs.
- **Albums**: Max depth is now 3 (level 1, 2, 3). MongoDB Album schema and controller updated.

## Phase 1: Run Both Databases (Current)

1. **Environment**
   - Keep `MONGO_URI` for MongoDB.
   - Add `DATABASE_URL` for PostgreSQL (e.g. `postgresql://user:pass@localhost:5432/bloomory`).
   - Optional: `SKIP_PG=true` to disable PostgreSQL; `SKIP_DB=true` to disable MongoDB.

2. **Schema**
   - Create PostgreSQL DB and run:
     ```bash
     psql "$DATABASE_URL" -f src/migrations/001_initial.sql
     ```
   - Tables: `users`, `memories`, `albums`, `media`, `login_events`, `conversations`, `messages`, `conversation_participants`, `ai_conversations`, `ai_messages`.

3. **Behavior**
   - Auth, memories, albums, media CRUD: MongoDB only (no change).
   - AI: If user is logged in and PostgreSQL is connected, each `/api/ai/ask` stores the exchange in `ai_conversations` and `ai_messages`; `conversationId` returned for follow-ups. History: `GET /api/ai/conversations/:id`.
   - Chat: WebSocket at `ws://host/ws/chat`; persistence to PG is skeleton (to be completed when replacing Firestore).

## Phase 2: Data Migration (One-Time)

1. **Export from MongoDB**
   - Export `users`, `memories`, `albums`, `media`, `login_events` (e.g. with `mongoexport` or a script using Mongoose).

2. **Map IDs**
   - MongoDB uses ObjectId; PostgreSQL uses UUID.
   - Build a mapping table: `mongo_id → uuid` for users, memories, albums, media.

3. **Transform and Load**
   - Convert documents to rows (snake_case columns, dates to TIMESTAMPTZ).
   - For `albums`: ensure `parent_id` and `level` (1–3) are correct; re-point `parent_id` to new UUIDs.
   - For `media`: keep `type`, `url`, `video_id`, `thumbnail_url`, `size_bytes`, etc.; re-point `user_id`, `memory_id`, `album_id` to new UUIDs.
   - Insert in dependency order: users → memories → albums → media; then `login_events` with mapped `user_id`.

4. **Cover and optional fields**
   - After `media` exists, backfill `memories.cover_media_id` and `albums.cover_media_id` using the mapping.

## Phase 3: Switch Reads/Writes to PostgreSQL

1. **Add a data layer**
   - Introduce a small abstraction (e.g. `repositories/` or `db/`) that uses either Mongoose or `pg` based on config (e.g. `USE_POSTGRES=true`).
   - Or replace Mongoose with an ORM (e.g. Prisma/Drizzle) and migrate route-by-route.

2. **Auth**
   - JWT today carries MongoDB `_id` in `sub`. Options:
     - **A**: Keep issuing JWTs with MongoDB id; in the new layer, resolve MongoDB id to PostgreSQL user (via mapping table) for reads/writes; or
     - **B**: Re-issue JWTs with PostgreSQL user UUID after migration and update Flutter to accept new tokens (logout/login or token refresh).
   - Prefer **A** for zero frontend change: maintain a `user_id_mapping` table (mongo_id, pg_uuid), and in middleware resolve `req.user.pgId` for PostgreSQL queries.

3. **Route-by-route**
   - Replace Mongoose calls with PostgreSQL queries (or ORM) for: auth (user lookup), users, memories, albums, media, login_events.
   - Keep request/response shapes identical so the Flutter app does not need changes.

4. **AI**
   - Already writes to PostgreSQL. Once users are in PostgreSQL, change `ai_conversations.user_id` from TEXT (Mongo id) to UUID and reference `users(id)`; backfill from mapping.

## Phase 4: Decommission MongoDB

1. **Cutover**
   - Set `USE_POSTGRES=true` (or remove MongoDB code path); remove `MONGO_URI` from production.
   - Optionally keep MongoDB read-only for a short time for comparison.

2. **Cleanup**
   - Remove Mongoose, `config/db.js` connection, and any dual-write or mapping code.
   - Update docs and `.env.example`.

## Checklist

- [ ] PostgreSQL schema applied (`001_initial.sql`).
- [ ] Bunny Stream configured (`BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`) for video uploads.
- [ ] Album depth 3 validated in creation (no level 4).
- [ ] AI conversation persistence tested (with auth + `DATABASE_URL`).
- [ ] WebSocket chat path `/ws/chat` tested; PG persistence completed when replacing Firestore.
- [ ] Migration script: MongoDB → PostgreSQL with ID mapping.
- [ ] Auth strategy chosen (JWT with Mongo id + mapping vs. re-issue with PG UUID).
- [ ] Route-by-route switch to PostgreSQL and removal of MongoDB.
