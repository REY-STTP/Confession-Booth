-- T1H-002: Add wallet_first_tx_at column to users table for wallet age tracking
-- This tracks the first on-chain transaction timestamp for wallet age calculation

ALTER TABLE users ADD COLUMN wallet_first_tx_at timestamptz;

-- Create index for efficient querying of new accounts
CREATE INDEX idx_users_wallet_first_tx_at ON users (wallet_first_tx_at);

-- Backfill: set wallet_first_tx_at to created_at for existing users as fallback
-- This will be updated on first on-chain transaction via walletFirstTxAt in auth flow
UPDATE users SET wallet_first_tx_at = created_at WHERE wallet_first_tx_at IS NULL;