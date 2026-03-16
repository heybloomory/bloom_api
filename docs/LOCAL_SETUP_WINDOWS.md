# BloomoryAI Backend — Local Setup (Windows)

Use this guide when Redis or PostgreSQL are not installed or not reachable.

---

## STEP 1 — Redis

### Check if Redis is reachable

```powershell
redis-cli ping
```

Expected: `PONG`. If `redis-cli` is not found or connection fails, install Redis.

### Option A: Docker (if installed)

```powershell
docker run -d -p 6379:6379 --name bloomory-redis redis
```

Then verify: `redis-cli ping` → `PONG`.

### Option B: Install Redis on Windows (no Docker)

**Note:** The BloomoryAI backend (BullMQ) requires **Redis 5.0 or newer**. The winget package `Redis.Redis` installs Redis 3.x, which is **too old**. Use one of:

- **Docker (recommended):** `docker run -d -p 6379:6379 --name bloomory-redis redis:7` (Redis 7).
- **Memurai** (Redis-compatible, Windows): https://www.memurai.com/ (supports Redis 5+).
- **WSL:** Install Redis inside WSL: `sudo apt install redis-server` (Redis 5+).

If you already installed Redis 3.x via winget, start it with:

```powershell
Start-Process "C:\Program Files\Redis\redis-server.exe" -ArgumentList "C:\Program Files\Redis\redis.windows.conf" -WindowStyle Hidden
```

The API and cache will work, but the **media queue and worker** will fail until you use Redis 5+ (BullMQ error: "Redis version needs to be greater or equal than 5.0.0").

2. **Or download installer:**
   - https://github.com/microsoftarchive/redis/releases  
   - Or: https://redis.io/docs/install/install-redis/install-redis-on-windows/

3. **Verify:**

   ```powershell
   redis-cli ping
   ```

   Expected: `PONG`.

---

## STEP 2 — PostgreSQL

### Check if psql exists

```powershell
psql --version
```

If not found, install PostgreSQL client (and server for local DB).

### Install on Windows

```powershell
winget install PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements
```

(Or use `PostgreSQL.PostgreSQL.17` / `PostgreSQL.PostgreSQL.18` if you prefer. Restart the terminal after install so `psql` is in PATH.)

Restart the terminal. Ensure the PostgreSQL bin directory is in PATH (e.g. `C:\Program Files\PostgreSQL\16\bin`).

**Start PostgreSQL:** After install, the PostgreSQL service may start automatically. If not, open **Services** (Win+R → `services.msc`), find **postgresql-x64-16** (or your version), and start it. Or from an elevated PowerShell: `Start-Service postgresql-x64-16`.

### Create database

```powershell
createdb -U postgres bloomory
```

(Use the user you configured; default is often `postgres`.)

### Verify connection

```powershell
psql -U postgres -d postgres
```

Then in psql: `\q` to quit.

Update `.env`:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/bloomory
```

If you used the default password `postgres` during PostgreSQL install, it is already set. Otherwise replace `YOUR_PASSWORD` (or the segment after `postgres:` in the URL) with your actual password.

---

## STEP 3 — Apply migrations

From the `bloom_api` folder, with `DATABASE_URL` set in `.env`:

**Option A — Node (no psql needed):**

```powershell
cd F:\Javed Bloom\bloom_api
npm run migrate
```

**Option B — Using psql (if in PATH):**

```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/bloomory"
psql $env:DATABASE_URL -f src/migrations/001_initial.sql
psql $env:DATABASE_URL -f src/migrations/002_indexes.sql
psql $env:DATABASE_URL -f src/migrations/003_media_constraints.sql
psql $env:DATABASE_URL -f src/migrations/004_fulltext_search.sql
```

**Verify tables:** After migrations, the Node script prints tables present. Or with psql: `psql $env:DATABASE_URL -c "\dt"`. You should see: `users`, `memories`, `albums`, `media`, `login_events`, etc.

---

## STEP 4 — Port 4000 conflict

If something is already using port 4000:

**Find process:**

```powershell
netstat -ano | findstr :4000
```

**Kill it (run as Administrator if needed):**

```powershell
taskkill /PID <PID> /F
```

Replace `<PID>` with the number from the last column of `netstat`.

**Or use a different port:** set in `.env`:

```
PORT=4001
```

Then use `http://localhost:4001` for the API (e.g. health: `http://localhost:4001/health`).

---

## STEP 5 — Start backend

```powershell
cd F:\Javed Bloom\bloom_api
npm start
```

Verify logs include:
- `PostgreSQL connected`
- `Server running on port 4001` (or 4000)

**Test health:**

```powershell
curl http://localhost:4001/health
```

Expected: `{"ok":true}` (or use port 4000 if you didn’t change it).

---

## STEP 6 — Start worker (second terminal)

```powershell
cd F:\Javed Bloom\bloom_api
npm run worker
```

Verify log: `Media worker started`.

---

## STEP 7 — Final verification

```powershell
curl http://localhost:4001/health
curl -H "Authorization: Bearer YOUR_JWT" "http://localhost:4001/api/search?q=test"
curl -H "Authorization: Bearer YOUR_JWT" "http://localhost:4001/api/timeline?limit=5"
```

Use a real JWT from login; `TEST_TOKEN` will return 401.

---

## Summary

| Step              | Command / action |
|-------------------|------------------|
| Redis             | `winget install Redis.Redis` or Docker; then `redis-cli ping` → PONG |
| PostgreSQL        | `winget install PostgreSQL.PostgreSQL`; create DB `bloomory` |
| Migrations        | `psql $env:DATABASE_URL -f src/migrations/001_initial.sql` (and 002, 003, 004) |
| Port conflict     | `taskkill /PID <PID> /F` or set `PORT=4001` in `.env` |
| Start API         | `npm start` |
| Start worker      | `npm run worker` (second terminal) |
