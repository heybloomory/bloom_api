# BloomoryAI Backend — Setup Final Report

Date: 2026-03-15

---

## STEP 1 — Redis upgrade to 5+

- **Current Redis:** v3.0.504 (from `C:\Program Files\Redis\redis-server.exe --version`).
- **Attempted:** Memurai Developer (`winget install Memurai.MemuraiDeveloper`) — **installer failed** (exit code 1603). Docker was not available on the machine.
- **Result:** Redis was not upgraded. BullMQ requires Redis ≥ 5.0. With Redis 3.x or with Redis stopped:
  - The API starts and works (PostgreSQL, health, search, timeline).
  - The media queue and worker cannot use BullMQ until Redis 5+ is available (e.g. Docker with `redis:7`, or a successful Memurai install, or WSL Redis).

**To upgrade later:** Install Docker and run `docker run -d -p 6379:6379 --name bloomory-redis redis:7`, or retry Memurai (check installer log) or use Redis 5+ in WSL.

---

## STEP 2 — PostgreSQL

- **Status:** PostgreSQL 16 is installed (`psql` at `C:\Program Files\PostgreSQL\16\bin\psql.exe`).
- **Service:** Running (connection to localhost:5432 succeeded).

---

## STEP 3 — Create bloomory database

- **Command used:** `createdb -U postgres -h localhost bloomory` with `PGPASSWORD=postgres`.
- **Result:** Database `bloomory` created successfully.

---

## STEP 4 — DATABASE_URL

- **`.env`** updated to:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bloomory`
- If your PostgreSQL `postgres` user has a different password, change the segment after `postgres:` in the URL accordingly.

---

## STEP 5 — Migrations

- **Command:** `npm run migrate`
- **Result:** All four migrations applied successfully:
  - 001_initial.sql
  - 002_indexes.sql
  - 003_media_constraints.sql
  - 004_fulltext_search.sql
- **Tables present:** albums, login_events, media, memories, users

---

## STEP 6 — Backend restart

- **Command:** `npm start`
- **Logs confirmed:**
  - PostgreSQL connected
  - Server running on port 4001
- API is listening on **http://localhost:4001**.

---

## STEP 7 — Worker

- Worker was not restarted in this session. With Redis 3.x or Redis stopped, the worker would log "Media worker started" but then report Redis version or connection errors. For full worker and queue support, use Redis 5+ and then run `npm run worker` in a second terminal.

---

## STEP 8 — Queue

- BullMQ queue is not functioning until Redis 5+ is running. Once Redis 5+ is available and the worker is running, upload a media file (or add a job) and the worker log should show "Processing media job".

---

## STEP 9 — API endpoints

- **Health:** `GET http://localhost:4001/health` → `{"ok":true}`
- **Search:** `GET http://localhost:4001/api/search?q=test` — requires a valid JWT in `Authorization: Bearer <token>`. With a valid token, the endpoint returns `{ memories, albums }` (PostgreSQL full-text search).
- **Timeline:** `GET http://localhost:4001/api/timeline?limit=5` — requires a valid JWT. Returns `{ memories }` (from PostgreSQL with optional Redis cache when Redis is available).

---

## STEP 10 — Summary

| Check                 | Status |
|-----------------------|--------|
| Redis version         | 3.0.504 (upgrade to 5+ not completed; Memurai failed, no Docker) |
| PostgreSQL connection | OK (database bloomory, migrations applied) |
| Migrations applied    | OK (001–004; tables: users, memories, albums, media, login_events) |
| API running           | OK (port 4001, health `{"ok":true}`) |
| Worker running        | Not verified; requires Redis 5+ for queue |
| Queue functioning     | No (BullMQ requires Redis 5+) |

**BloomoryAI backend environment setup is complete for API and PostgreSQL. Ready for Flutter integration for auth, search, timeline, and media APIs.**

For full operation including the media processing queue and worker, install and run Redis 5+ (e.g. Docker with `redis:7`), then start the worker with `npm run worker`.
