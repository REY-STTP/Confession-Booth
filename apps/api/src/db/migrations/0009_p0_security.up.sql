-- Migration 0009: P0 hardening — PoW single-use + admin bootstrap audit (REPORTS.md P0 #3/#4)
CREATE TABLE IF NOT EXISTS pow_solutions (
  solution_hash varchar(128) PRIMARY KEY,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pow_solutions_expiry ON pow_solutions(expires_at);

CREATE TABLE IF NOT EXISTS admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar(32) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  role varchar(16),
  ip_hash varchar(128),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_wallet ON admin_audit(wallet_address);
