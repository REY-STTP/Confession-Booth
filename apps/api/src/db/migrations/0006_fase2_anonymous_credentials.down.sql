-- Rollback Migration 0006
DROP TABLE IF EXISTS epoch_nullifiers;
DROP TABLE IF EXISTS identity_commitments;
ALTER TABLE confessions DROP COLUMN IF EXISTS proof_type;
ALTER TABLE confessions DROP COLUMN IF EXISTS nullifier_hash;
