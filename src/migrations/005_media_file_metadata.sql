-- Persist original uploaded filename and Bunny storage key for media records.
-- Run after 001_initial.sql.

ALTER TABLE media
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

ALTER TABLE media
  ADD COLUMN IF NOT EXISTS original_file_name TEXT NOT NULL DEFAULT '';
