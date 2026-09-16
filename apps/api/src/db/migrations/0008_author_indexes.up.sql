-- 0008_author_indexes.up.sql
-- AUDIT DB-001 & DB-002: Add missing indexes on author_user_id for duplicate/abuse checks and badge calculations.
CREATE INDEX IF NOT EXISTS idx_confessions_author ON confessions(author_user_id) WHERE author_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whispers_author ON whispers(author_user_id) WHERE author_user_id IS NOT NULL;
