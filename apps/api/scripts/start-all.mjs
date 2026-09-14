// Start gabungan staging T1G (Render free 1 service): API + 4 worker satu proses.
// Worker tanpa kredensial (RPC/IPFS/Redis) skip aman — publish tetap PENDING_CHAIN.
// API mati → semua dimatikan + exit 1 (platform restart service).
// Worker crash → log + restart worker setelah 5 detik.
import { spawn } from 'node:child_process';

const procs = new Map();
let shuttingDown = false;

function start(name, args) {
  console.log(`[start-all] starting ${name}`);
  const p = spawn(process.execPath, args, { stdio: 'inherit' });
  procs.set(name, p);
  p.on('exit', (code) => {
    procs.delete(name);
    if (shuttingDown) return;
    if (name === 'api') {
      console.error(`[start-all] api exit ${code} — mematikan semua`);
      shutdown(1);
    } else {
      console.error(`[start-all] ${name} exit ${code} — restart 5s`);
      setTimeout(() => {
        if (!shuttingDown) start(name, args);
      }, 5000);
    }
  });
  return p;
}

function shutdown(code) {
  shuttingDown = true;
  for (const [, p] of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      // abaikan
    }
  }
  setTimeout(() => process.exit(code), 3000).unref();
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

start('api', ['./dist/index.js']);
start('worker:publisher', ['./dist/workers/publisher.js']);
start('worker:indexer', ['./dist/workers/indexer.js']);
start('worker:ranking', ['./dist/workers/ranking.js']);
start('worker:abuse', ['./dist/workers/abuse.js']);
