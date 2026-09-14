-- Rollback T1H-004 (dev/staging saja).
DROP INDEX IF EXISTS idx_whispers_tsv;
ALTER TABLE whispers DROP COLUMN IF EXISTS body_tsv;
DROP INDEX IF EXISTS idx_confessions_trgm;
DROP INDEX IF EXISTS idx_confessions_tsv;
ALTER TABLE confessions DROP COLUMN IF EXISTS body_tsv;
-- pg_trgm sengaja TIDAK di-drop (extension shared).
