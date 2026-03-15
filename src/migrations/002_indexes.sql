-- Performance indexes for large-scale usage.
-- Idempotent: safe to run multiple times (IF NOT EXISTS).
-- Use: psql $DATABASE_URL -f src/migrations/002_indexes.sql

-- Users (lookup by email/phone)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- Memories (by user, by created)
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories (user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories (created_at DESC);

-- Albums (by memory, by parent)
CREATE INDEX IF NOT EXISTS idx_albums_memory ON albums (memory_id);
CREATE INDEX IF NOT EXISTS idx_albums_parent ON albums (parent_id);

-- Media (by album, memory, user, type)
CREATE INDEX IF NOT EXISTS idx_media_album ON media (album_id);
CREATE INDEX IF NOT EXISTS idx_media_memory ON media (memory_id);
CREATE INDEX IF NOT EXISTS idx_media_user ON media (user_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media (type);

-- Messages (by conversation)
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id);
