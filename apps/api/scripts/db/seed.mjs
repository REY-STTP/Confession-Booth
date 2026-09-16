// Seed idempoten: node scripts/db/seed.mjs — 11 kategori (SCHEMA §6).
import pg from 'pg';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const CATEGORIES = [
  ['love', 'Love', 1],
  ['heartbreak', 'Heartbreak', 2],
  ['secret', 'Secret', 3],
  ['life', 'Life', 4],
  ['school', 'School', 5],
  ['work', 'Work', 6],
  ['family', 'Family', 7],
  ['funny', 'Funny', 8],
  ['sad', 'Sad', 9],
  ['deep', 'Deep', 10],
  ['midnight', 'Midnight', 11],
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL belum di-set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
for (const [slug, name, order] of CATEGORIES) {
  await pool.query(
    `INSERT INTO categories (slug, name, sort_order) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true`,
    [slug, name, order],
  );
}
const { rows } = await pool.query('SELECT count(*)::int AS n FROM categories WHERE is_active = true');
console.log(`seed: ${rows[0].n} kategori aktif`);
await pool.end();
