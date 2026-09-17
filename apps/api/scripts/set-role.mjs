// Bootstrap/perubahan role via shell (butuh akses DB langsung — bukan via HTTP).
// Pemakaian: node apps/api/scripts/set-role.mjs <0xWallet> <MODERATOR|ADMIN>
// P0 #3: tanpa default wallet (wajib argumen), role divalidasi, dan setiap
// eksekusi dicatat di admin_audit agar selaras dengan /api/admin/grant-role.
import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
}

const wallet = (process.argv[2] ?? '').toLowerCase();
const role = (process.argv[3] ?? '').toUpperCase();

if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
  console.error('Pemakaian: node apps/api/scripts/set-role.mjs <0xWallet40hex> <MODERATOR|ADMIN>');
  process.exit(1);
}
if (role !== 'MODERATOR' && role !== 'ADMIN') {
  console.error('Role harus MODERATOR atau ADMIN.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum di-set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const res = await pool.query(
    'UPDATE users SET role = $1 WHERE wallet_address = $2 RETURNING id, wallet_address, role, status',
    [role, wallet],
  );
  if (res.rows.length === 0) {
    const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111', 10);
    const ins = await pool.query(
      `INSERT INTO users (wallet_address, chain_id, role, status, wallet_first_tx_at, last_seen_at)
       VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (wallet_address) DO UPDATE SET role = $3
       RETURNING id, wallet_address, role, status, chain_id`,
      [wallet, chainId, role],
    );
    console.log('Inserted new user with role:', ins.rows);
  } else {
    console.log('Update result:', res.rows);
  }
  await pool.query(
    `INSERT INTO admin_audit (action, wallet_address, role) VALUES ('GRANT_ROLE', $1, $2)`,
    [wallet, role],
  );
  console.log('Audit recorded in admin_audit.');
} finally {
  await pool.end();
}
