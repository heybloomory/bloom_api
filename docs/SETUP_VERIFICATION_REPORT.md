# BloomoryAI Backend — Setup Verification Report

Run date: 2026-03-15 (local setup attempt)

---

## STEP 1 — Prepare environment file

**Status: OK**

- `.env` file exists in project root.
- Missing variables were added for local run: `DATABASE_URL`, `USE_POSTGRES`, `REDIS_URL`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`.
- **Warning:** `BUNNY_STREAM_LIBRARY_ID` and `BUNNY_STREAM_API_KEY` are empty; video uploads will fail until set.
- Required variables present: `DATABASE_URL`, `USE_POSTGRES`, `REDIS_URL`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_KEY`, `BUNNY_CDN_BASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET`.

---

## STEP 2 — Install dependencies

**Status: OK**

- `npm install` completed successfully.
- Verified installed: `pg`, `bullmq`, `ioredis`, `ws`.

---

## STEP 3 — Start Redis (local development)

**Status: FAILED**

- **Error:** Docker is not available (`docker` command not recognized). Redis could not be started via `docker run -d -p 6379:6379 --name bloomory-redis redis`.
- Port 6379 is not reachable (connection refused).
- **Command that would be used:** `docker run -d -p 6379:6379 --name bloomory-redis redis`
- **To fix:** Install Docker Desktop (or add Docker to PATH), then run the command above; or install and start Redis for Windows (e.g. WSL Redis or a native Redis build) and ensure it listens on `localhost:6379`.

---

## STEP 4 — Apply PostgreSQL migrations

**Status: FAILED**

- **Error:** `psql` was not found in PATH. Migrations could not be run.
- **Commands that would be used:**
  ```bash
  psql "$DATABASE_URL" -f src/migrations/001_initial.sql
  psql "$DATABASE_URL" -f src/migrations/002_indexes.sql
  psql "$DATABASE_URL" -f src/migrations/003_media_constraints.sql
  psql "$DATABASE_URL" -f src/migrations/004_fulltext_search.sql
  ```
- **To fix:** Install PostgreSQL client (or full PostgreSQL) and add `psql` to PATH. On Windows, ensure `DATABASE_URL` is set (e.g. in PowerShell: `$env:DATABASE_URL = "postgresql://user:password@localhost:5432/bloomory"`) and run the four `psql` commands above. Ensure PostgreSQL server is running and the database exists.

---

## STEP 5 — Verify migration (if Mongo data exists)

**Status: SKIPPED**

- Migration scripts exist (`npm run verify:migration`), but migrations were not applied (STEP 4 failed). Verification was not run.
- If you have Mongo data and later apply migrations, run: `npm run verify:migration`.

---

## STEP 6 — Start backend API

**Status: FAILED**

- **Errors observed when running `npm start`:**
  1. **Redis:** `ECONNREFUSED 127.0.0.1:6379` — Redis is not running; the app (or BullMQ queue) attempts to connect at startup.
  2. **PostgreSQL:** `PostgreSQL connection failed` — PostgreSQL server not reachable or not running for `DATABASE_URL`.
  3. **Port:** `EADDRINUSE: address already in use 0.0.0.0:4000` — Another process (e.g. a previous API instance) is already using port 4000.
- Server did not reach a state where it printed “Server running” or “PostgreSQL connected”.
- **Command used:** `npm start`
- **To fix:** Start Redis and PostgreSQL, apply migrations (STEP 4), then stop any process on port 4000 and run `npm start` again.

---

## STEP 7 — Start worker process

**Status: NOT RUN**

- Worker was not started because Redis is not running (`npm run worker` requires `REDIS_URL` and a running Redis). When Redis is available, run in a second terminal: `npm run worker`. Expected log: `Media worker started`.

---

## STEP 8 — Test API endpoints

**Status: NOT RUN**

- API server did not start successfully, so endpoints were not tested.
- **Note:** `GET /api/timeline` and `GET /api/search?q=test` require a valid JWT in `Authorization: Bearer <token>`. Using `TEST_TOKEN` will result in 401 Unauthorized; use a token from login/signup.

---

## STEP 9 — Final verification summary

| Item                      | Status        |
|---------------------------|---------------|
| Redis running             | No (STEP 3 failed) |
| PostgreSQL migrations applied | No (STEP 4 failed) |
| API server running        | No (STEP 6 failed) |
| Worker running            | No (STEP 7 not run) |
| Search endpoint available | Not verified  |
| Timeline endpoint available | Not verified |

**Failures and commands:**

1. **STEP 3:** Docker not available; Redis not started.  
   Command: `docker run -d -p 6379:6379 --name bloomory-redis redis`

2. **STEP 4:** `psql` not found; migrations not applied.  
   Commands: `psql "$DATABASE_URL" -f src/migrations/001_initial.sql` (and same for 002, 003, 004).

3. **STEP 6:** Server exited due to Redis ECONNREFUSED, PostgreSQL connection failure, and port 4000 already in use.  
   Command: `npm start`

---

## Next steps to run the backend locally

1. **Redis:** Install Docker (or Redis for Windows) and start Redis on port 6379, or use a cloud Redis and set `REDIS_URL` accordingly.
2. **PostgreSQL:** Install PostgreSQL, create database `bloomory` (or match `DATABASE_URL`), ensure server is running, add `psql` to PATH, then run the four migration files in order.
3. **Port 4000:** Stop the process using port 4000 (e.g. previous `npm start`), or set `PORT` in `.env` to another port.
4. Start API: `npm start`.
5. In a second terminal, start worker: `npm run worker`.
6. Test with a valid JWT: `GET /health`, `GET /api/timeline`, `GET /api/search?q=test`.
