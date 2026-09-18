-- Migration 0010 rollback (dev/staging saja)
DROP INDEX IF EXISTS uq_commitment_owner;
ALTER TABLE identity_commitments DROP COLUMN IF EXISTS user_id;
DROP INDEX IF EXISTS idx_reports_iphash;
ALTER TABLE reports DROP COLUMN IF EXISTS reporter_ip_hash;
