import type { FastifyPluginAsync } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/client.js';
import { metricsSnapshot, sloSnapshot } from '../metrics.js';
import { rowsOf } from './common.js';

export const systemRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => ({
    ok: true,
    service: 'booth-api',
    mode: 'db',
    time: new Date().toISOString(),
  }));

  app.get('/api/health/chain', async () => ({
    ok: true,
    chainId: String(config.chainId),
    contractConfigured: Boolean(
      config.contractAddress && !config.contractAddress.startsWith('0x0000'),
    ),
  }));

  // T1-041: metrics tanpa secret (tanpa isi confession/signature/IP mentah).
  // AUDIT SEC-001 + P1 #6: selalu butuh ADMIN_SECRET (>=32, compare timing-safe).
  // Tanpa secret → 503, bukan data terbuka.
  app.get('/api/metrics', async (req, reply) => {
    if (!checkAdminSecret(req.headers['x-admin-secret'])) {
      const code = adminSecretConfigured() ? 'FORBIDDEN' : 'ADMIN_DISABLED';
      return reply
        .code(adminSecretConfigured() ? 403 : 503)
        .send({ error: { code, message: 'Admin access required.' } });
    }
    const db = getDb();
    let queueDepth = 0;
    try {
      const r = rowsOf<{ n: string }>(
        await db.execute(sql`SELECT count(*) AS n FROM reports WHERE status = 'OPEN'`),
      );
      queueDepth = Number(r[0]?.n ?? 0);
    } catch {
      queueDepth = -1;
    }
    return { ...(metricsSnapshot() as object), queue: { openReports: queueDepth } };
  });

  // T1H-006: SLO read 99.5% + p95<500ms (window lifetime proses; Prometheus di prod).
  // AUDIT SEC-001 + P1 #6: perlindungan sama seperti /metrics.
  app.get('/api/slo', async (req, reply) => {
    if (!checkAdminSecret(req.headers['x-admin-secret'])) {
      const code = adminSecretConfigured() ? 'FORBIDDEN' : 'ADMIN_DISABLED';
      return reply
        .code(adminSecretConfigured() ? 403 : 503)
        .send({ error: { code, message: 'Admin access required.' } });
    }
    return sloSnapshot();
  });
};

function adminSecretConfigured(): boolean {
  const s = process.env.ADMIN_SECRET ?? '';
  return s.length >= 32;
}

function checkAdminSecret(got: unknown): boolean {
  const secret = process.env.ADMIN_SECRET ?? '';
  return (
    typeof got === 'string' &&
    secret.length >= 32 &&
    got.length === secret.length &&
    timingSafeEqual(Buffer.from(got, 'utf8'), Buffer.from(secret, 'utf8'))
  );
}
