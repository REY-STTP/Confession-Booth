-- Migration 0010: P1 #7/#9 — anon report per-IP-hash + commitment ownership.
-- 1. reports.reporter_ip_hash: dedup laporan anonim per (target, reason, ip)
--    agar satu anon tidak bisa memblokir semua anon lain (DoS throttle global).
-- 2. identity_commitments.user_id: kepemilikan komitmen untuk cap per-user +
--    UNIQUE(user_id, commitment) anti-spam registrasi.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_ip_hash varchar(128);
CREATE INDEX IF NOT EXISTS idx_reports_iphash
  ON reports(reporter_ip_hash, target_id, reason_code, created_at);

ALTER TABLE identity_commitments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_commitment_owner') THEN
    CREATE UNIQUE INDEX uq_commitment_owner ON identity_commitments(user_id, commitment);
  END IF;
END $$;
