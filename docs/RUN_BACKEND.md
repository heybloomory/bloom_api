# BloomoryAI Backend — Run Instructions

Use these steps to run the backend locally or prepare for production. Do not change existing API routes or response formats used by the Flutter frontend.

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Start Redis

With Docker:

```bash
docker run -d -p 6379:6379 --name redis redis
```

Or use a local Redis server. Set `REDIS_URL` (e.g. `redis://localhost:6379`) in `.env`.

---

## 3. Apply PostgreSQL migrations

Create the database if needed, then run migrations in order:

```bash
psql "$DATABASE_URL" -f src/migrations/001_initial.sql
psql "$DATABASE_URL" -f src/migrations/002_indexes.sql
psql "$DATABASE_URL" -f src/migrations/003_media_constraints.sql
psql "$DATABASE_URL" -f src/migrations/004_fulltext_search.sql
```

*(Requires PostgreSQL 11+ for `EXECUTE FUNCTION` in 004_fulltext_search.sql.)*

---

## 4. (Optional) Migrate from MongoDB to PostgreSQL

If you have existing data in MongoDB:

```bash
npm run migrate:mongo-to-pg
```

Requires `MONGO_URI` and `DATABASE_URL` in `.env`.

---

## 5. Verify migration

After migrating:

```bash
npm run verify:migration
```

Exits with an error if user, memory, album, or media counts differ between MongoDB and PostgreSQL.

---

## 6. Enable PostgreSQL

In `.env`:

```
USE_POSTGRES=true
```

---

## 7. Start the backend API

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

---

## 8. Start the media worker (separate process)

In a second terminal:

```bash
npm run worker
```

Requires `REDIS_URL`. Processes jobs from the `media-processing` queue (e.g. after media uploads).

---

## 9. Test API endpoints

- Health: `GET /health`
- Timeline (auth required): `GET /api/timeline?limit=20&offset=0`
- Search (auth required): `GET /api/search?q=test`

Use an `Authorization: Bearer <token>` header for protected routes.

---

## Environment variables

Copy `.env.example` to `.env` and fill in values. See `docs/ENV_VARIABLES.md` for full reference.

Required for full operation: `DATABASE_URL`, `USE_POSTGRES`, `REDIS_URL`, Bunny Storage vars, Bunny Stream vars (for video), `OPENAI_API_KEY`, `JWT_SECRET`. `MONGO_URI` required if running migration or not using PostgreSQL yet.
