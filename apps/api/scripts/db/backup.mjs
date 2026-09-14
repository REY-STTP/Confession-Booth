// Backup PG T1-040: pg_dump custom-format + restore drill.
// Pakai: `npm run db:backup` (butuh DATABASE_URL + pg_dump di PATH).
// Restore drill: `npm run db:restore -- backups/booth-YYYY-MM-DD.dump`
import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL ?? '';
if (!url) {
  console.error('[backup] DATABASE_URL belum di-set');
  process.exit(1);
}
const mode = process.argv[2] ?? 'backup';
const file = process.argv[3] ?? `backups/booth-${new Date().toISOString().slice(0, 10)}.dump`;

if (mode === 'backup') {
  mkdirSync('backups', { recursive: true });
  execFile('pg_dump', ['-Fc', '-f', file, url], (err, _stdout, stderr) => {
    if (err) {
      console.error(`[backup] gagal: ${stderr || err.message}`);
      process.exit(1);
    }
    console.log(`[backup] ok: ${file}`);
  });
} else if (mode === 'restore') {
  execFile('pg_restore', ['--clean', '--if-exists', '-d', url, file], (err, _stdout, stderr) => {
    if (err) {
      console.error(`[restore] gagal: ${stderr || err.message}`);
      process.exit(1);
    }
    console.log(`[restore] ok: ${file}`);
  });
} else {
  console.error('[backup] pakai: node scripts/db/backup.mjs [backup|restore] [file]');
  process.exit(1);
}
