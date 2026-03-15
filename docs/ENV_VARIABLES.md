# Environment Variables

## Existing (MongoDB, Auth, Storage)

- `MONGO_URI` – MongoDB connection string (required unless `SKIP_DB=true`)
- `JWT_SECRET` – Secret for signing JWTs
- **Bunny Storage (images):** `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_KEY` (Storage API key), `BUNNY_CDN_BASE_URL`. Optional: `BUNNY_STORAGE_REGION` / `BUNNY_STORAGE_HOST` for regional endpoints.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `AI_RATE_WINDOW_MS`, `AI_RATE_MAX` – AI
- `CORS_ORIGIN`, `PORT`, `NODE_ENV`
- `SKIP_DB=true` – Skip MongoDB connection (e.g. local dev)

## New (PostgreSQL, Bunny Stream, Optional)

- **`DATABASE_URL`** – PostgreSQL connection string, e.g. `postgresql://user:password@localhost:5432/bloomory`  
  Used for: AI conversation history, chat messages (when implemented), and **primary data** when `USE_POSTGRES=true`.  
  If not set or `SKIP_PG=true`, PostgreSQL is not used; AI still works but does not persist history.

- **`USE_POSTGRES=true`** – Use PostgreSQL for all main data (users, memories, albums, media, login_events). When set, controllers use the repository layer instead of Mongoose. Requires `DATABASE_URL` and a completed migration (see docs/RUN_MIGRATION.md).

- **`SKIP_PG=true`** – Skip PostgreSQL connection at startup.

- **`BUNNY_STREAM_LIBRARY_ID`** – Bunny Stream library ID (required for video uploads).  
  If not set, video uploads will fail; image uploads are unchanged.

- **`BUNNY_STREAM_API_KEY`** – Bunny Stream API key (required for video uploads).

- **`PG_POOL_MAX`** – Optional; max connections in the PostgreSQL pool (default 10).

- **`REDIS_URL`** – Optional. Redis connection URL (e.g. `redis://localhost:6379`).  
  The server calls `connectRedis()` at startup. When set, Redis is used for:  
  **Current use:**
  - **WebSocket pub/sub** – scale chat across multiple API instances.
  - **Caching** – `src/utils/cache.js` (`getCache`, `setCache`, `deleteCache`) use Redis when connected; they no-op when Redis is not configured.
  - **BullMQ queue** – media processing queue (thumbnails, compression, AI tagging). Run the worker as a separate process: `npm run worker`. Uploads enqueue a job after successful media create.
  - **Timeline caching** – `src/utils/timelineCache.js` caches GET /api/timeline responses (key: `timeline:{userId}:{limit}:{offset}`, TTL 60 seconds) to speed up feed queries.
  **Planned use:**
  - **Rate limiting** – store rate-limit counters (e.g. AI, uploads).
  - **AI request caching** – cache frequent AI answers by question hash.

## Summary

| Variable                   | Required for           |
|---------------------------|------------------------|
| `MONGO_URI`               | All existing API (or migration source) |
| `DATABASE_URL`            | PostgreSQL; AI history, primary data when `USE_POSTGRES=true` |
| `USE_POSTGRES`            | Set `true` to use PostgreSQL for users, memories, albums, media |
| `REDIS_URL`               | Optional; cache, WebSocket pub/sub, BullMQ queue, timeline caching |
| `BUNNY_STORAGE_ZONE`      | Bunny Storage (images) |
| `BUNNY_STORAGE_KEY`       | Bunny Storage API key (images) |
| `BUNNY_CDN_BASE_URL`      | Bunny CDN base URL (images) |
| `BUNNY_STREAM_LIBRARY_ID` | Video uploads         |
| `BUNNY_STREAM_API_KEY`    | Video uploads         |
| `OPENAI_API_KEY`          | AI assistant          |
