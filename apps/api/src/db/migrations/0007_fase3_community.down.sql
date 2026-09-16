-- Rollback 0007: Fase 3 — Community

ALTER TABLE whispers
  DROP COLUMN IF EXISTS badge_type,
  DROP COLUMN IF EXISTS parent_whisper_id;

ALTER TABLE confessions
  DROP COLUMN IF EXISTS badge_type,
  DROP COLUMN IF EXISTS room_id;

DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
