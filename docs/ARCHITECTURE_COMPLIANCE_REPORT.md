# BloomoryAI — Architecture Compliance Report

This document compares the **current implementation** (bloom_app + bloom_api) against the **intended architecture** for a large-scale memories and life-stories platform.

---

## 1. Architecture Compliance Report

### Summary Table

| Area | Intended | Current | Status |
|------|----------|---------|--------|
| **Backend framework** | Node.js (Express) | Express 4.x | ✅ Matches |
| **Database** | PostgreSQL (source of truth) | MongoDB (Mongoose) | ❌ Does not match |
| **Auth** | JWT, stored locally | JWT in SharedPreferences + Firebase Auth for Google | ✅ Largely matches |
| **Media – images** | Bunny Storage + BunnyCDN | Bunny Storage + CDN (`bunnyStorage.js`) | ✅ Matches |
| **Media – videos** | Bunny Stream only; videoId + embed URL in DB | All media (incl. video) to Bunny Storage | ❌ Does not match |
| **Folder hierarchy** | User → Memory → Album (L1) → Sub (L2) → Sub (L3), max depth 3 | User → Memory → Album; levels 1–2 only, max depth 2 | ⚠️ Partially matches |
| **Chat** | WebSocket server (backend) | Firebase Firestore (conversations/messages) | ❌ Does not match |
| **API – auth** | POST register, login, GET me | Present (register, login, login-email, google, me) | ✅ Matches |
| **API – memories/albums/media** | POST/GET memories, albums, media/upload | Present | ✅ Matches |
| **API – AI** | POST /api/ai/ask | POST /api/ai/ask (no conversation persistence) | ✅ Endpoint matches; ❌ No ai_conversations/ai_messages |
| **Backend services** | auth-, user-, memory-, album-, media-, ai-, chat-service | Single app; routes: auth, users, memories, albums, media, ai (no chat) | ⚠️ Logical services exist as route modules; no chat-service |

---

### What Already Matches

- **Frontend:** Flutter single codebase; REST to backend; JWT stored locally (`AuthSession`); media upload via API (`MediaApiService.uploadToAlbum` → `POST /api/media/upload`).
- **Backend:** Express, JWT (jsonwebtoken), REST for auth, users, memories, albums, media, AI.
- **Auth endpoints:** `POST /api/auth/register`, `POST /api/auth/login` (and login-email, google), `GET /api/auth/me`.
- **Memories/albums/media endpoints:** `POST/GET /api/memories`, `POST/GET /api/albums`, `POST /api/media/upload`, etc.
- **AI endpoint:** `POST /api/ai/ask`.
- **Images:** Upload flow goes through backend; backend uploads to Bunny Storage and returns CDN URL; stored in DB (MongoDB).
- **Data hierarchy:** User → Memory → Album with `parentId` and `level`; Media references `user_id`, `memory_id`, `album_id`.
- **Login events:** `LoginEvent` model exists (MongoDB).
- **Albums table:** Has `parent_id` (as `parentId`), `level` (1 or 2), `user_id`, `memory_id`, `title`, `description`, `created_at`.

---

### What Does NOT Match

| Item | Intended | Current | Required change |
|------|----------|---------|------------------|
| **Database** | PostgreSQL | MongoDB (Mongoose) | Migrate to PostgreSQL (see Migration section). |
| **Videos** | Upload to **Bunny Stream**; store `video_id` and playback URL (e.g. `https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}`) | All files (incl. video) uploaded to Bunny Storage via `uploadToBunny()` | Add Bunny Stream API; video upload path → Bunny Stream; store `video_id` (+ optional thumbnail_url); keep images on Bunny Storage. |
| **Media table** | `type` (image \| video), `url` (images), `thumbnail_url`, `video_id` (Bunny Stream), `size_bytes`, etc. | Has `type`, `url`, `thumbUrl`, `key`; no `video_id` | Add `video_id` (and optionally `video_playback_url`); use `url` for images only; keep `thumbnail_url` for both. |
| **Album depth** | Max folder depth = **3** (Album L1 → Sub L2 → Sub L3) | `level` enum `[1, 2]` only; controller rejects `parent.level >= 2` | Extend to `level` 1, 2, 3; allow parent level 2 to have children (level 3). |
| **Chat** | WebSocket server (backend) for real-time chat | Chat uses **Firebase Firestore** (conversations/messages) in Flutter | Add WebSocket server (e.g. `ws` or `socket.io`); persist chat in PostgreSQL (e.g. `conversations`, `messages`); Flutter connects to backend WebSocket. |
| **AI persistence** | Tables: `ai_conversations`, `ai_messages` | Stateless `/api/ai/ask`; no DB persistence | Optional: add PostgreSQL tables and persist conversations/messages; optionally add `conversationId` to `/api/ai/ask`. |
| **Naming** | Example: `parent_id`, `user_id` (snake_case in schema) | Mongoose uses camelCase (`parentId`, `userId`) | In PostgreSQL use snake_case column names; API can keep camelCase in JSON. |

---

## 2. Required Changes (Targeted)

### 2.1 Database: Migrate MongoDB → PostgreSQL

- **Scope:** Replace Mongoose with a PostgreSQL client (e.g. `pg` or an ORM like `node-pg-migrate`, Drizzle, or Prisma).
- **Tables to create:** `users`, `memories`, `albums`, `media`, `login_events`; optionally `ai_conversations`, `ai_messages`, and for chat `conversations`, `messages`.
- **Schema:** See “Correct PostgreSQL schema” below.
- **Migration steps:** See “Migration steps if MongoDB is currently used” below.

### 2.2 Backend: Video Upload → Bunny Stream

- **New utility:** e.g. `src/utils/bunnyStream.js` (or extend existing) that:
  - Uses Bunny Stream API (create video, upload by multipart or pull zone URL).
  - Returns `videoId` and playback URL: `https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}`.
- **Media controller:** In `uploadMedia`:
  - If `type === 'video'`: do **not** call `uploadToBunny()` for the main file; call Bunny Stream upload; get `videoId`; set `video_id` and playback URL (and optionally `thumbnail_url` if you generate one).
  - If `type === 'image'`: keep current flow (Bunny Storage + CDN).
- **Media model/schema:** Add `video_id` (and optionally `video_playback_url`). For images, `url` remains required; for videos, `video_id` (and playback URL) required.

### 2.3 Album Hierarchy: Support Level 3

- **Album model/schema:** Allow `level` in `[1, 2, 3]` (not only 1–2).
- **Album controller:** In `createAlbum`, allow parent with `level === 2` to have children (new album with `level = 3`). Reject only when `parent.level >= 3` (or when depth would exceed 3).

### 2.4 Chat: WebSocket + PostgreSQL

- **Backend:** Add WebSocket server (e.g. `ws` or `socket.io`) alongside HTTP; authenticate via JWT (e.g. query or first message).
- **PostgreSQL:** Add `conversations` and `messages` tables; persist messages when sent.
- **Flutter:** Replace Firestore-based chat with WebSocket client to backend; use REST or WebSocket for loading history if needed.

### 2.5 AI (Optional)

- **PostgreSQL:** Add `ai_conversations` and `ai_messages` if you want persistent AI history.
- **API:** Optional `conversationId` (or create conversation) on `POST /api/ai/ask` and return `conversationId` in response.

### 2.6 API and Frontend

- **Auth:** Keep `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`; ensure Flutter uses JWT for all API calls where required.
- **AI:** Flutter `AiApiService` should send `Authorization: Bearer <token>` if backend protects `/api/ai/ask`.
- **Media response:** After video changes, API should return `video_id` and playback URL; Flutter should use playback URL for video and `url` for images.

---

## 3. Improved Project Folder Structure

Suggested layout for **bloom_api** (backend) after introducing services and optional WebSocket:

```
bloom_api/
├── package.json
├── .env.example
├── src/
│   ├── server.js              # HTTP + optional WebSocket server boot
│   ├── app.js                 # Express app, REST routes
│   ├── config/
│   │   ├── db.js              # PostgreSQL connection (replace MongoDB)
│   │   └── firebaseAdmin.js
│   ├── services/              # (optional) business logic layer
│   │   ├── auth-service.js
│   │   ├── user-service.js
│   │   ├── memory-service.js
│   │   ├── album-service.js
│   │   ├── media-service.js   # image → Bunny Storage, video → Bunny Stream
│   │   ├── ai-service.js
│   │   └── chat-service.js    # WebSocket + DB
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── memories.js
│   │   ├── albums.js
│   │   ├── media.js
│   │   ├── ai.js
│   │   └── chat.js            # optional REST for history
│   ├── controllers/
│   │   └── ...                # thin; delegate to services if added
│   ├── models/                # replace with PostgreSQL (migrations or ORM)
│   │   └── (remove Mongoose; use SQL migrations or ORM entities)
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── notFound.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── bunnyStorage.js    # images only (Bunny Storage + CDN)
│   │   ├── bunnyStream.js     # video upload → Bunny Stream
│   │   ├── loginAudit.js
│   │   └── httpError.js
│   ├── validators/
│   └── migrations/           # PostgreSQL migrations (if using pg-migrate etc.)
│       └── 001_initial.sql
└── docs/
    └── ARCHITECTURE_COMPLIANCE_REPORT.md (this file)
```

**bloom_app** (Flutter) can stay as-is; ensure:

- `lib/core/services/` keeps `api_config`, `auth_session`, `auth_api_service`, `media_api_service`, `album_api_service`, `ai_api_service`.
- Chat feature later points to backend WebSocket + REST instead of Firestore.

---

## 4. Correct PostgreSQL Schema

Below is a schema that matches the intended architecture (snake_case columns, PostgreSQL).

### 4.1 users

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE,
  phone             TEXT UNIQUE,
  name              TEXT NOT NULL DEFAULT '',
  password_hash     TEXT,
  plan              TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'personal', 'partner', 'vendor')),
  avatar_url        TEXT NOT NULL DEFAULT '',
  last_login_at     TIMESTAMPTZ,
  last_login_ip    TEXT,
  last_login_device TEXT,
  last_login_location JSONB,
  providers         JSONB DEFAULT '{}',
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
```

### 4.2 memories

```sql
CREATE TABLE memories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  tags            TEXT[] DEFAULT '{}',
  is_favorite     BOOLEAN NOT NULL DEFAULT false,
  visibility      TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- After media table exists: ALTER TABLE memories ADD COLUMN cover_media_id UUID REFERENCES media (id);

CREATE INDEX idx_memories_user_id ON memories (user_id);
CREATE INDEX idx_memories_user_created ON memories (user_id, created_at DESC);
```

**Schema order:** Create `memories` and `albums` without `cover_media_id` first, then create `media`, then `ALTER TABLE memories ADD COLUMN cover_media_id ... REFERENCES media(id)` and same for `albums`, to avoid forward references.

### 4.3 albums (with parent_id and level, max depth 3)

```sql
CREATE TABLE albums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  memory_id       UUID REFERENCES memories (id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES albums (id) ON DELETE CASCADE,
  level           SMALLINT NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3)),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- After media table exists: ALTER TABLE albums ADD COLUMN cover_media_id UUID REFERENCES media (id);

CREATE INDEX idx_albums_user_id ON albums (user_id);
CREATE INDEX idx_albums_parent_id ON albums (parent_id);
CREATE INDEX idx_albums_user_parent_created ON albums (user_id, parent_id, created_at DESC);
```

### 4.4 media (image vs video: url vs video_id)

```sql
CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  memory_id       UUID REFERENCES memories (id) ON DELETE SET NULL,
  album_id        UUID REFERENCES albums (id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url             TEXT,                    -- for images (BunnyCDN); null for video-only
  thumbnail_url   TEXT NOT NULL DEFAULT '',
  video_id        TEXT,                    -- Bunny Stream video ID (when type = 'video')
  size_bytes      BIGINT,
  width           INT,
  height          INT,
  mime_type       TEXT DEFAULT '',
  duration_sec    NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_media_image_has_url CHECK (type <> 'image' OR url IS NOT NULL AND url <> ''),
  CONSTRAINT chk_media_video_has_video_id CHECK (type <> 'video' OR video_id IS NOT NULL AND video_id <> '')
);

CREATE INDEX idx_media_user_id ON media (user_id);
CREATE INDEX idx_media_album_id ON media (album_id);
CREATE INDEX idx_media_memory_id ON media (memory_id);
CREATE INDEX idx_media_user_album_created ON media (user_id, album_id, created_at DESC);
```

Playback URL can be computed as `https://iframe.mediadelivery.net/embed/{libraryId}/{video_id}`; you can store it in a generated column or in app code.

### 4.5 login_events

```sql
CREATE TABLE login_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  method     TEXT NOT NULL CHECK (method IN ('password', 'google')),
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip         TEXT,
  user_agent TEXT,
  device     TEXT,
  location   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_events_user_id ON login_events (user_id);
CREATE INDEX idx_login_events_at ON login_events (at DESC);
```

### 4.6 ai_conversations / ai_messages (optional)

```sql
CREATE TABLE ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages (conversation_id, created_at);
```

### 4.7 Chat (conversations / messages) — for WebSocket chat

```sql
CREATE TABLE conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
  -- add participant columns or a separate conversation_participants table if multi-user
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'text',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at);
```

---

## 5. Media Upload Architecture (Image vs Video)

- **Images**
  - Client sends file to `POST /api/media/upload` (multipart).
  - Backend detects image (or `type=image`), uploads to **Bunny Storage** via `uploadToBunny()`.
  - CDN URL is stored in `media.url`; optional `thumbnail_url` if thumbnail uploaded.
  - Delivery: BunnyCDN (e.g. `https://<zone>.b-cdn.net/<key>`).

- **Videos**
  - Client sends video file to `POST /api/media/upload` (multipart).
  - Backend detects video (or `type=video`), does **not** upload to Bunny Storage.
  - Backend uploads to **Bunny Stream** (create video + upload or pull URL); obtains `videoId`.
  - Store in `media`: `type = 'video'`, `video_id = videoId`, `thumbnail_url` (if generated), optionally computed playback URL or store it. Leave `url` null or use for thumbnail if desired.
  - Playback: `https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}`.

**Flow summary**

```
User uploads file
  → Backend API receives (multer)
  → If image: upload to Bunny Storage → store url (+ thumbnail_url) in media
  → If video: upload to Bunny Stream → get videoId → store video_id (+ thumbnail_url) in media
  → Return media record to client
```

---

## 6. Migration Steps (MongoDB → PostgreSQL)

1. **Setup PostgreSQL**
   - Create database and user; add `DATABASE_URL` (or separate host/db/user/password) to `.env`.
   - Install `pg` (and optionally an ORM or migration tool).

2. **Create schema in PostgreSQL**
   - Run the SQL from section 4 (in order: users → memories → albums → media → login_events → optional ai_* and chat tables). Resolve circular refs (e.g. memories.cover_media_id, albums.cover_media_id) with a follow-up migration if needed.

3. **Data migration**
   - One-time script: read from MongoDB (User, Memory, Album, Media, LoginEvent); map ObjectId → UUID; insert into PostgreSQL. Preserve created_at/updated_at and relationships (user_id, memory_id, album_id, parent_id).

4. **Switch backend to PostgreSQL**
   - Replace `src/config/db.js` with PostgreSQL connection.
   - Replace Mongoose models with queries or ORM (e.g. Prisma/Drizzle). Use the same route and controller structure; only the data layer changes.
   - Update auth middleware to read user from PostgreSQL by id (from JWT).
   - Ensure JWT payload uses a stable user id (UUID after migration).

5. **Video pipeline**
   - Implement Bunny Stream upload in `src/utils/bunnyStream.js`.
   - In media upload controller, branch on type: image → Bunny Storage; video → Bunny Stream; write `video_id` (and optional url/thumbnail_url) in `media` table.

6. **Album level 3**
   - Change album schema to allow `level` 3; update create-album logic so a level-2 parent can have level-3 children; enforce max depth 3.

7. **Chat (if required)**
   - Add WebSocket server; add `conversations` and `messages` tables; implement chat-service; update Flutter to use backend WebSocket instead of Firestore.

8. **Validation**
   - Run existing (or new) integration tests against PostgreSQL; verify auth, memories, albums, media (image + video), and optional AI/chat.

---

## Document control

- **Version:** 1.0  
- **Date:** 2025-03-15  
- **Scope:** bloom_api (Node/Express) + bloom_app (Flutter) vs intended BloomoryAI architecture.
