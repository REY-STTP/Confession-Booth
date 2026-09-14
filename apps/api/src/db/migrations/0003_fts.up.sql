-- T1H-004: Full-text search + trigram untuk feed/search Indonesia.
-- 'simple' dipakai (bukan stemmer Inggris) + pg_trgm untuk substring/typo.
-- Hanya untuk VISIBLE (filter status tetap di query, bukan di index parsial agar murah).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE confessions ADD COLUMN IF NOT EXISTS body_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body_text, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_confessions_tsv ON confessions USING GIN (body_tsv);
CREATE INDEX IF NOT EXISTS idx_confessions_trgm ON confessions USING GIN (body_text gin_trgm_ops);

ALTER TABLE whispers ADD COLUMN IF NOT EXISTS body_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body_text, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_whispers_tsv ON whispers USING GIN (body_tsv);
