-- BloomoryAI PostgreSQL schema (initial).
-- Run after creating the database. Order respects FK dependencies.
-- Use: psql $DATABASE_URL -f src/migrations/001_initial.sql

-- Users (no FK to media/memories to avoid circular refs)
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE,
  phone             TEXT UNIQUE,
  name              TEXT NOT NULL DEFAULT '',
  password_hash     TEXT,
  plan              TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'personal', 'partner', 'vendor')),
  avatar_url        TEXT NOT NULL DEFAULT '',
  last_login_at     TIMESTAMPTZ,
  last_login_ip     TEXT,
  last_login_device TEXT,
  last_login_location JSONB,
  providers         JSONB DEFAULT '{}',
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL;

-- Memories (no cover_media_id yet to avoid forward ref)
CREATE TABLE IF NOT EXISTS memories (
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

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_created ON memories (user_id, created_at DESC);

-- Albums (parent_id, level 1–3; no cover_media_id until media exists)
CREATE TABLE IF NOT EXISTS albums (
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

CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums (user_id);
CREATE INDEX IF NOT EXISTS idx_albums_parent_id ON albums (parent_id);
CREATE INDEX IF NOT EXISTS idx_albums_user_parent_created ON albums (user_id, parent_id, created_at DESC);

-- Media (image: url; video: video_id + thumbnail_url)
CREATE TABLE IF NOT EXISTS media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  memory_id       UUID REFERENCES memories (id) ON DELETE SET NULL,
  album_id        UUID REFERENCES albums (id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url             TEXT,
  thumbnail_url   TEXT NOT NULL DEFAULT '',
  video_id        TEXT,
  storage_key     TEXT,
  original_file_name TEXT NOT NULL DEFAULT '',
  size_bytes      BIGINT,
  width           INT,
  height          INT,
  mime_type       TEXT DEFAULT '',
  duration_sec    NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_media_image_has_url CHECK (type <> 'image' OR (url IS NOT NULL AND url <> '')),
  CONSTRAINT chk_media_video_has_video_id CHECK (type <> 'video' OR (video_id IS NOT NULL AND video_id <> ''))
);

CREATE INDEX IF NOT EXISTS idx_media_user_id ON media (user_id);
CREATE INDEX IF NOT EXISTS idx_media_album_id ON media (album_id);
CREATE INDEX IF NOT EXISTS idx_media_memory_id ON media (memory_id);
CREATE INDEX IF NOT EXISTS idx_media_user_album_created ON media (user_id, album_id, created_at DESC);

-- Add cover_media_id to memories and albums (after media exists)
ALTER TABLE memories ADD COLUMN IF NOT EXISTS cover_media_id UUID REFERENCES media (id);
ALTER TABLE albums  ADD COLUMN IF NOT EXISTS cover_media_id UUID REFERENCES media (id);

-- Login events
CREATE TABLE IF NOT EXISTS login_events (
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

CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON login_events (user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_at ON login_events (at DESC);

-- Chat: conversations and messages (for WebSocket chat)
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'text',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);

-- Conversation participants (many-to-many: users ↔ conversations)
CREATE TABLE IF NOT EXISTS conversation_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants (user_id);

-- AI conversations and messages (user_id can be MongoDB id during transition; later migrate to UUID)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations (user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages (conversation_id, created_at);
