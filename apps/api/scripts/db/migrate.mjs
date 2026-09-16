// Migration runner minimal: node scripts/db/migrate.mjs [up|down]
// - up: terapkan migrasi pending berurutan, catat di __migrations.
// - down: rollback SATU migrasi terakhir (dev/staging saja).
import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'db', 'migrations');
const mode = process.argv[2] ?? 'up';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL belum di-set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const baseNames = [...new Set(readdirSync(dir).filter((f) => f.endsWith('.up.sql')).map((f) => f.replace(/\.up\.sql$/, '')))].sort();

await pool.query(`CREATE TABLE IF NOT EXISTS __migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);

if (mode === 'up') {
  const { rows } = await pool.query('SELECT name FROM __migrations');
  const done = new Set(rows.map((r) => r.name));
  for (const name of baseNames) {
    if (done.has(name)) continue;
    const sql = readFileSync(join(dir, `${name}.up.sql`), 'utf8');
    console.log(`migrate up: ${name}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO __migrations (name) VALUES ($1)', [name]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }
  console.log('migrate up: done');
} else if (mode === 'down') {
  const { rows } = await pool.query('SELECT name FROM __migrations ORDER BY name DESC LIMIT 1');
  if (rows.length === 0) {
    console.log('migrate down: nothing to roll back');
  } else {
    const name = rows[0].name;
    const sql = readFileSync(join(dir, `${name}.down.sql`), 'utf8');
    console.log(`migrate down: ${name}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('DELETE FROM __migrations WHERE name = $1', [name]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }
} else {
  console.error('mode harus up|down');
  process.exitCode = 1;
}

await pool.end();
