-- Rollback: Remove wallet_first_tx_at column
ALTER TABLE users DROP COLUMN IF EXISTS wallet_first_tx_at;
DROP INDEX IF EXISTS idx_users_wallet_first_tx_at;