-- T1H-002: Add indexer_mismatches table for tracking hash mismatches
-- This enables investigation of silent data corruption

CREATE TABLE IF NOT EXISTS indexer_mismatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id varchar(66) NOT NULL,
  onchain_hash varchar(128) NOT NULL,
  db_hash varchar(128) NOT NULL,
  block_number bigint NOT NULL,
  tx_hash varchar(66) NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolution_notes text
);

CREATE INDEX idx_indexer_mismatches_confession ON indexer_mismatches (confession_id);
CREATE INDEX idx_indexer_mismatches_detected ON indexer_mismatches (detected_at);
CREATE INDEX idx_indexer_mismatches_unresolved ON indexer_mismatches (resolved) WHERE resolved = false;