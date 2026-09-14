// Runner test Node lintas-platform (T1G/CI): discovery *.test.js rekursif +
// oper path file eksplisit ke `node --test`.
// Alasan: ekspansi glob `dist/**/*.test.js` beda perilaku di sh (Linux CI) vs
// cmd (Windows) dan semantik `**` beda antar versi Node → "Could not find".
// Dipakai: `node ../../scripts/run-node-tests.mjs dist [--seq]`.
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [dirArg, ...rest] = process.argv.slice(2);
const root = resolve(dirArg ?? 'dist');
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.test.js')) files.push(p);
  }
})(root);
if (files.length === 0) {
  console.error(`[run-node-tests] tidak ada *.test.js di ${root}`);
  process.exit(1);
}
const args = ['--test', ...(rest.includes('--seq') ? ['--test-concurrency=1'] : []), ...files.sort()];
const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
