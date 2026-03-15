-- Media table: enforce image vs video structure.
-- Idempotent: constraints only added if missing.
-- Use: psql $DATABASE_URL -f src/migrations/003_media_constraints.sql

-- Images: must NOT have video_id (url already required by chk_media_image_has_url in 001)
ALTER TABLE media DROP CONSTRAINT IF EXISTS chk_media_image_no_video_id;
ALTER TABLE media ADD CONSTRAINT chk_media_image_no_video_id
  CHECK (type <> 'image' OR (video_id IS NULL OR video_id = ''));

-- Videos: must have video_id; url optional (playback URL) — already in 001_initial.sql
