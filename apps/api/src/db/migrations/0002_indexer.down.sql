-- 0002_indexer DOWN.
ALTER TABLE publications DROP COLUMN IF EXISTS attempts;
DROP TABLE IF EXISTS indexer_state;
