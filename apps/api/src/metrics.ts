// Observability hemat-privasi T1-041.
// - Log hanya {request_id, method, url, status, latency} — JANGAN log isi confession/signature.
// - Metrics in-memory: request/error per route, tx failure, worker lag, queue depth.
// - Alert ambang: indexer lag >5 mnt, tx gagal >5%/jam (cek via /api/metrics).
type Row = { requests: number; errors: number };

const routes = new Map<string, Row>();
let txFailed = 0;
let txTotal = 0;
let indexerLagSec: number | null = null;
const startedAt = Date.now();
// T1H-006: latensi read terakhir (cap 1000) untuk p50/p95 SLO.
const latencies: number[] = [];

function routeKey(method: string, url: string): string {
  // Normalisasi ID agar kardinalitas rendah (c_xxx/w_xxx → :id).
  const path = url.split('?')[0].replace(/\/(c|w)_[A-Za-z0-9_-]+/g, '/:id');
  return `${method} ${path}`;
}

export function recordRequest(
  method: string,
  url: string,
  status: number,
  latencyMs?: number,
): void {
  const k = routeKey(method, url);
  const r = routes.get(k) ?? { requests: 0, errors: 0 };
  r.requests += 1;
  if (status >= 500) r.errors += 1;
  routes.set(k, r);
  // T1H-006: hanya latensi read publik yang masuk SLO (tulis/auth bervariasi).
  if (
    latencyMs !== undefined &&
    method === 'GET' &&
    (url.startsWith('/api/feed') || url.startsWith('/api/confessions'))
  ) {
    latencies.push(latencyMs);
    if (latencies.length > 1000) latencies.splice(0, latencies.length - 1000);
  }
}

export function recordTx(ok: boolean): void {
  txTotal += 1;
  if (!ok) txFailed += 1;
}

export function recordIndexerLag(sec: number | null): void {
  indexerLagSec = sec;
}

export function metricsSnapshot(): object {
  const txFailRate = txTotal > 0 ? txFailed / txTotal : 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const pct = (p: number) =>
    sorted.length === 0
      ? null
      : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  let total = 0;
  let errors = 0;
  for (const r of routes.values()) {
    total += r.requests;
    errors += r.errors;
  }
  return {
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    routes: Object.fromEntries(routes),
    tx: { total: txTotal, failed: txFailed, failRate: Number(txFailRate.toFixed(4)) },
    reads: {
      n: sorted.length,
      p50Ms: pct(50),
      p95Ms: pct(95),
      successRate: total > 0 ? Number(((total - errors) / total).toFixed(4)) : null,
    },
    indexerLagSec,
    alerts: {
      indexerLagOver5m: indexerLagSec !== null && indexerLagSec > 300,
      txFailOver5pct: txTotal >= 20 && txFailRate > 0.05,
    },
  };
}

/** T1H-006: evaluasi SLO 99.5% success + p95 read <500ms (window: lifetime proses). */
export function sloSnapshot(): object {
  const s = metricsSnapshot() as {
    reads: { n: number; p50Ms: number | null; p95Ms: number | null; successRate: number | null };
  };
  const okSuccess = s.reads.successRate === null || s.reads.successRate >= 0.995;
  const okP95 = s.reads.p95Ms === null || s.reads.p95Ms < 500;
  return {
    target: { successRate: 0.995, p95Ms: 500 },
    current: s.reads,
    ok: okSuccess && okP95,
    window: 'process-lifetime (Prometheus di prod)',
  };
}

/** P2 #15: format Prometheus exposition dari snapshot (scrape-ready).
 *  Tanpa label kardinalitas tinggi (route sudah dinormalisasi :id di recordRequest). */
export function metricsPrometheus(s: object): string {
  const snap = s as {
    uptimeSec: number;
    routes: Record<string, { requests: number; errors: number }>;
    tx: { total: number; failed: number; failRate: number };
    reads: { n: number; p50Ms: number | null; p95Ms: number | null };
    indexerLagSec: number | null;
    alerts: { indexerLagOver5m: boolean; txFailOver5pct: boolean };
  };
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const num = (v: number | null) => (v === null || !Number.isFinite(v) ? 'Nan' : String(v));
  const L: string[] = [
    '# HELP booth_uptime_seconds Process uptime.',
    '# TYPE booth_uptime_seconds gauge',
    `booth_uptime_seconds ${snap.uptimeSec}`,
    '# HELP booth_requests_total Requests per normalized route.',
    '# TYPE booth_requests_total counter',
    '# HELP booth_errors_total Errors per normalized route.',
    '# TYPE booth_errors_total counter',
  ];
  for (const [route, r] of Object.entries(snap.routes)) {
    L.push(`booth_requests_total{route="${esc(route)}"} ${r.requests}`);
    L.push(`booth_errors_total{route="${esc(route)}"} ${r.errors}`);
  }
  L.push(
    '# HELP booth_tx_fail_rate Publisher failure rate.',
    '# TYPE booth_tx_fail_rate gauge',
    `booth_tx_fail_rate ${snap.tx.failRate}`,
    '# HELP booth_read_latency_ms Read latency percentiles.',
    '# TYPE booth_read_latency_ms gauge',
    `booth_read_latency_ms{quantile="0.5"} ${num(snap.reads.p50Ms)}`,
    `booth_read_latency_ms{quantile="0.95"} ${num(snap.reads.p95Ms)}`,
    '# HELP booth_indexer_lag_seconds Indexer lag.',
    '# TYPE booth_indexer_lag_seconds gauge',
    `booth_indexer_lag_seconds ${num(snap.indexerLagSec)}`,
    '# HELP booth_alert Active alerts (1 = firing).',
    '# TYPE booth_alert gauge',
    `booth_alert{name="indexer_lag_over_5m"} ${snap.alerts.indexerLagOver5m ? 1 : 0}`,
    `booth_alert{name="tx_fail_over_5pct"} ${snap.alerts.txFailOver5pct ? 1 : 0}`,
  );
  return L.join('\n') + '\n';
}
