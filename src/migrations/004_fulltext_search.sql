-- Full-text search: tsvector columns and GIN indexes for memories and albums.
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- Use: psql $DATABASE_URL -f src/migrations/004_fulltext_search.sql

-- Memories: search_vector
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE memories
SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_memories_search
  ON memories USING GIN (search_vector);

CREATE OR REPLACE FUNCTION update_memories_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memories_search_vector_trigger ON memories;
CREATE TRIGGER memories_search_vector_trigger
  BEFORE INSERT OR UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memories_search_vector();

-- Albums: search_vector
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE albums
SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_albums_search
  ON albums USING GIN (search_vector);

CREATE OR REPLACE FUNCTION update_albums_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS albums_search_vector_trigger ON albums;
CREATE TRIGGER albums_search_vector_trigger
  BEFORE INSERT OR UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION update_albums_search_vector();
