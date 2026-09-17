// Operator helper: jalankan satu pernyataan SQL (pengganti psql bila belum terinstal).
// Pemakaian: npm run db:query --workspace @booth/api -- "SELECT name FROM __migrations ORDER BY name DESC LIMIT 3;"
// Hanya untuk operator tepercaya — jangan expose sebagai endpoint HTTP.
import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
}

const sql = process.argv[2];
if (!sql) {
  console.error('Pemakaian: npm run db:query --workspace @booth/api -- "SELECT 1"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum di-set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const r = await pool.query(sql);
  if (r.rows.length > 0) console.log(JSON.stringify(r.rows, null, 2));
  console.log(`rowCount: ${r.rowCount ?? 0}`);
} finally {
  await pool.end();
}
