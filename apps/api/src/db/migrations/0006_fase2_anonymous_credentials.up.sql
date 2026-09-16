-- Migration 0006: Fase 2 Anonymous Credentials, Epoch Nullifiers, and Nullable Author for ZK Confessions
ALTER TABLE confessions ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE confessions ADD COLUMN IF NOT EXISTS nullifier_hash varchar(128);
ALTER TABLE confessions ADD COLUMN IF NOT EXISTS proof_type varchar(32) NOT NULL DEFAULT 'SESSION';
CREATE INDEX IF NOT EXISTS idx_confessions_nullifier ON confessions(nullifier_hash);

CREATE TABLE IF NOT EXISTS identity_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment varchar(128) NOT NULL UNIQUE,
  leaf_index serial NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commitments_index ON identity_commitments(leaf_index);

CREATE TABLE IF NOT EXISTS epoch_nullifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nullifier_hash varchar(128) NOT NULL,
  epoch integer NOT NULL,
  scope varchar(32) NOT NULL DEFAULT 'confess',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_epoch_nullifier UNIQUE (nullifier_hash, epoch, scope)
);
CREATE INDEX IF NOT EXISTS idx_epoch_nullifiers_lookup ON epoch_nullifiers(nullifier_hash, epoch, scope);
