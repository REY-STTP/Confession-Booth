import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const wallet = (process.argv[2] ?? '0x1d1afc2d015963017bed1de13e4ed6c3d3ed1618').toLowerCase();
const role = (process.argv[3] ?? 'MODERATOR').toUpperCase();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const res = await pool.query(
    'UPDATE users SET role = $1 WHERE wallet_address = $2 RETURNING id, wallet_address, role, status',
    [role, wallet]
  );
  if (res.rows.length === 0) {
    const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111', 10);
    const ins = await pool.query(
      `INSERT INTO users (wallet_address, chain_id, role, status, wallet_first_tx_at, last_seen_at)
       VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (wallet_address) DO UPDATE SET role = $3
       RETURNING id, wallet_address, role, status, chain_id`,
      [wallet, chainId, role]
    );
    console.log('Inserted new user with role:', ins.rows);
  } else {
    console.log('Update result:', res.rows);
  }
} finally {
  await pool.end();
}
