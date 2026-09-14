// Load ringan T1-050 (TESTING §8): feed paging + trending + cursor invalid.
// Pakai: `npm run load` (butuh API + DB jalan; default http://localhost:4000).
// Target lokal: p95 read <500ms. Bukan k6 penuh — smoke kuantitatif sebelum staging.
const BASE = process.env.LOAD_BASE_URL ?? 'http://localhost:4000';
const N = Number(process.env.LOAD_N ?? 200);
const CONC = Number(process.env.LOAD_CONC ?? 10);

async function timed(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  await res.text().catch(() => '');
  return { ms: performance.now() - t0, status: res.status };
}

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

const urls = [
  `${BASE}/api/feed?sort=new&limit=20`,
  `${BASE}/api/feed?sort=trending&limit=20`,
  `${BASE}/api/feed?sort=relatable&limit=20`,
  `${BASE}/api/feed?category=sad&limit=10`,
  `${BASE}/api/feed?cursor=!!!`,
  `${BASE}/api/health`,
  `${BASE}/api/metrics`,
];

const lat = [];
let bad = 0;
for (let i = 0; i < N; i += CONC) {
  const batch = [];
  for (let j = 0; j < CONC && i + j < N; j++) {
    batch.push(timed(urls[(i + j) % urls.length]));
  }
  const out = await Promise.all(batch);
  for (const r of out) {
    lat.push(r.ms);
    if (r.status >= 500) bad += 1;
  }
}
const p50 = pct(lat, 50);
const p95 = pct(lat, 95);
console.log(`[load] n=${N} conc=${CONC} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms errors5xx=${bad}`);
if (bad > 0) {
  console.error('[load] gagal: ada 5xx');
  process.exit(1);
}
if (p95 >= 500) {
  console.error('[load] gagal: p95 >= 500ms (target lokal)');
  process.exit(1);
}
console.log('[load] ok: p95 < 500ms, tanpa 5xx');
