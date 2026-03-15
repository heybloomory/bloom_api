# Running the MongoDB → PostgreSQL Migration

## Prerequisites

- MongoDB running and populated (current source of truth).
- PostgreSQL database created and **empty** (schema applied, no application data).
- Environment variables: `MONGO_URI`, `DATABASE_URL`.

## Step 1: Apply PostgreSQL schema

If not already done:

```bash
psql "$DATABASE_URL" -f src/migrations/001_initial.sql
```

## Step 2: Run the migration script

From the project root:

```bash
node scripts/migrateMongoToPostgres.js
```

The script will:

1. Connect to MongoDB and PostgreSQL.
2. Read `users` → insert into `users` (new UUID per user).
3. Read `memories` → insert with mapped `user_id`.
4. Read `albums` → insert with mapped `user_id`, `memory_id`, `parent_id` (level 1–3 preserved).
5. Read `media` → insert with mapped `user_id`, `memory_id`, `album_id` (image/video, `url`/`video_id`).
6. Backfill `cover_media_id` on memories and albums.
7. Read `login_events` (from `loginevents` or `login_events` collection) → insert with mapped `user_id`.

All IDs become UUIDs in PostgreSQL. The script uses batching (100 records per batch) to limit memory use.

## Step 3: Verify counts

```bash
node scripts/verifyMigration.js
```

This compares MongoDB vs PostgreSQL record counts for `users`, `memories`, `albums`, and `media`. If any count differs, the script exits with code 1 and reports which table(s) have mismatches.

## Step 4: Switch the app to PostgreSQL

1. Set in your environment (e.g. `.env`):

   ```env
   USE_POSTGRES=true
   ```

2. Restart the API. Controllers will use the PostgreSQL repositories instead of Mongoose.

3. **Important:** JWTs issued before migration contain MongoDB `_id` in `sub`. After migration, the API expects **UUID** in `sub`. So either:

   - **Option A:** Re-issue tokens: have users log in again (register/login/Google) so new JWTs contain PostgreSQL user UUID.
   - **Option B:** Keep a mapping table (mongo_id → pg uuid) and in auth middleware resolve `payload.sub` (Mongo id) to PG user by mapping, then load user from PG by UUID. (Not implemented in this repo; add if you need it.)

Recommendation: after migration, force re-login (e.g. bump JWT version or clear sessions) so all tokens use UUID.

## Step 5: (Optional) Decommission MongoDB

Once you have verified that the app works correctly with `USE_POSTGRES=true`:

- Stop writing to MongoDB.
- You can keep MongoDB read-only for a while, then remove `MONGO_URI` and Mongoose code in a later cleanup.

## Rollback

If you need to roll back:

1. Set `USE_POSTGRES=false` (or unset) and restart → app uses MongoDB again.
2. PostgreSQL data remains; you can re-run migration after fixing issues (e.g. run on a fresh PG database if needed).
