// Backup drill T1H-006: dump → verifikasi (size + pg_restore --list) → hapus temp.
// Membuktikan backup TERUJI tanpa restore ke DB produksi.
// Butuh pg_dump/pg_restore di PATH atau PGBIN (mis. E:\PostgreSQL\18\bin).
// Pakai: `npm run db:backup:verify` (butuh DATABASE_URL).
import { execFile } from 'node:child_process';
import { mkdtempSync, statSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const PGBIN = process.env.PGBIN ?? '';
const bin = (n) => (PGBIN ? join(PGBIN, n) : n);
const url = process.env.DATABASE_URL ?? '';
if (!url) {
  console.error('[backup:verify] DATABASE_URL belum di-set');
  process.exit(1);
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });

const dir = mkdtempSync(join(tmpdir(), 'booth-backup-'));
const file = join(dir, 'verify.dump');
try {
  await run(bin('pg_dump'), ['-Fc', '-f', file, url]);
  const size = statSync(file).size;
  if (size <= 0) throw new Error('dump kosong');
  const list = await run(bin('pg_restore'), ['--list', file]);
  const tables = list.split('\n').filter((l) => l.includes('TABLE DATA')).length;
  if (tables < 10) throw new Error(`tabel terdump hanya ${tables} (<10)`);
  console.log(`[backup:verify] ok: size=${size}B tables=${tables} file=${file}`);
} catch (e) {
  console.error(`[backup:verify] gagal: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
