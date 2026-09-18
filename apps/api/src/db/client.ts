// Koneksi DB runtime: pg Pool + drizzle. Satu instance per proses.
import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

let pool: pg.Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL belum di-set (lihat .env.example)');
    // P2 #15: clamp agar NaN/0/negatif tak meledakkan pg.Pool atau mengunci DB.
    const rawMax = Number(process.env.DB_POOL_MAX ?? 10);
    const max = Number.isSafeInteger(rawMax) && rawMax > 0 ? Math.min(rawMax, 50) : 10;
    pool = new pg.Pool({ connectionString, max });
  }
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) db = drizzle(getPool(), { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
