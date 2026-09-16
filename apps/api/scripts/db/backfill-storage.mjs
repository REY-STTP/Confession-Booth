// Backfill storage T1H-001: upload konten inline lama (db:inline, cid null) ke adapter
// aktif (IPFS bila STORAGE_ENDPOINT di-set) + isi content_objects.storage_cid.
// Aman diulang (idempoten: skip yang sudah punya CID). Verifikasi hash tiap baris.
// Pakai: `npm run db:backfill-storage` (butuh DATABASE_URL).
import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[backfill] DATABASE_URL belum di-set');
  process.exit(1);
}

// Import adapter tanpa menarik server (hindari side-effect): duplikasi resolve minimal.
const endpoint = (process.env.STORAGE_ENDPOINT ?? '').trim();
if (!endpoint) {
  console.log('[backfill] STORAGE_ENDPOINT kosong — tidak ada yang dimigrasi (tetap db:inline)');
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const { rows } = await pool.query(`
  SELECT co.id, co.content_hash, c.body_text
  FROM content_objects co
  JOIN confessions c ON c.content_object_id = co.id
  WHERE co.storage_cid IS NULL
  UNION
  SELECT co.id, co.content_hash, w.body_text
  FROM content_objects co
  JOIN whispers w ON w.content_object_id = co.id
  WHERE co.storage_cid IS NULL
  LIMIT 500
`);

let ok = 0;
let skip = 0;
for (const r of rows) {
  const normalized = (r.body_text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  const actual = createHash('sha256').update(normalized, 'utf8').digest('hex');
  if (actual !== r.content_hash) {
    console.warn(`[backfill] skip hash mismatch ${r.id}`);
    skip += 1;
    continue;
  }
  const form = new FormData();
  form.append('file', new Blob([r.body_text], { type: 'text/plain' }));
  const headers = {};
  if (process.env.STORAGE_API_KEY) {
    const cred = Buffer.from(`${process.env.STORAGE_API_KEY}:${process.env.STORAGE_API_SECRET ?? ''}`).toString('base64');
    headers.Authorization = `Basic ${cred}`;
  }
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/v0/add?pin=true`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) throw new Error(`ipfs add: ${res.status}`);
    const lines = (await res.text()).trim().split('\n');
    const { Hash } = JSON.parse(lines[lines.length - 1]);
    if (!Hash) throw new Error('tanpa Hash');
    await pool.query(
      `UPDATE content_objects SET storage_provider = 'ipfs:http', storage_cid = $2 WHERE id = $1::uuid`,
      [r.id, Hash],
    );
    ok += 1;
  } catch (e) {
    console.warn(`[backfill] gagal ${r.id}: ${e instanceof Error ? e.message : e}`);
    skip += 1;
  }
}
console.log(`[backfill] ok=${ok} skip=${skip}`);
await pool.end();
