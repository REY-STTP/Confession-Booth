// Tracing minimal T1H-006: JSON lines {trace_id, op, status, latency_ms}.
// Tanpa PII (tidak pernah log body/signature). OTel collector (OTEL_EXPORTER_OTLP_*)
// bisa ditempel kemudian — nama field sudah OTel-friendly (trace_id/span).
import { randomBytes } from 'node:crypto';

export async function trace<T>(op: string, fn: () => Promise<T>, attrs: Record<string, unknown> = {}): Promise<T> {
  const traceId = randomBytes(8).toString('hex');
  const start = Date.now();
  try {
    const out = await fn();
    console.log(JSON.stringify({ trace_id: traceId, op, status: 'ok', latency_ms: Date.now() - start, ...attrs }));
    return out;
  } catch (e) {
    console.log(JSON.stringify({ trace_id: traceId, op, status: 'error', latency_ms: Date.now() - start, ...attrs }));
    throw e;
  }
}
