import type { FastifyPluginAsync } from 'fastify';
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
  // AUDIT SEC-001: dilindungi ADMIN_SECRET agar tidak jadi information disclosure.
  app.get('/api/metrics', async (req, reply) => {
    const secret = process.env.ADMIN_SECRET ?? '';
    if (secret) {
      if (req.headers['x-admin-secret'] !== secret) {
        return reply
          .code(403)
          .send({ error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return reply
        .code(403)
        .send({ error: { code: 'FORBIDDEN', message: 'Admin secret not configured.' } });
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
  // AUDIT SEC-001: dilindungi ADMIN_SECRET.
  app.get('/api/slo', async (req, reply) => {
    const secret = process.env.ADMIN_SECRET ?? '';
    if (secret) {
      if (req.headers['x-admin-secret'] !== secret) {
        return reply
          .code(403)
          .send({ error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return reply
        .code(403)
        .send({ error: { code: 'FORBIDDEN', message: 'Admin secret not configured.' } });
    }
    return sloSnapshot();
  });
};
