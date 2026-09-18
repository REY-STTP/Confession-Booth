import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { config } from './config.js';
import { getDb } from './db/client.js';
import { authenticate } from './auth.js';
import { recordRequest } from './metrics.js';

// Modular route plugins (AUDIT PERF-001 / CODE-001)
import { systemRoutes } from './routes/system.js';
import { authRoutes } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { confessionRoutes } from './routes/confessions.js';
import { whisperRoutes } from './routes/whispers.js';
import { moderationRoutes } from './routes/moderation.js';
import { zkRoutes } from './routes/zk.js';

// Re-export common helpers for backward-compatibility with tests/external callers
export { encodeCursor, decodeCursor, escapeLike } from './routes/common.js';

export async function buildApp(): Promise<FastifyInstance> {
  // P2 #15: clamp agar BODY_LIMIT 0/NaN tak jadi DoS (default 100 KiB).
  const rawBodyLimit = Number(process.env.BODY_LIMIT ?? 102_400);
  const bodyLimit =
    Number.isSafeInteger(rawBodyLimit) && rawBodyLimit > 0
      ? Math.min(rawBodyLimit, 10_485_760)
      : 102_400;
  const app = Fastify({
    logger: true,
    bodyLimit,
    // P1 #6: trustProxy eksplisit dari config (default false — anti IP spoof).
    trustProxy: config.trustProxy,
    routerOptions: { maxParamLength: 128 },
  });

  // T1-024: error JSON konsisten, tanpa stack/HTML leak.
  app.setErrorHandler((err, req, reply) => {
    const status =
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    if (status >= 500) app.log.error({ err, requestId: (req as { id?: string }).id });
    const msg = err instanceof Error ? err.message : 'Error';
    reply.code(status >= 400 && status < 600 ? status : 500).send({
      error: {
        code:
          status === 400
            ? 'BAD_REQUEST'
            : status === 404
              ? 'NOT_FOUND'
              : status === 429
                ? 'RATE_LIMITED'
                : 'INTERNAL',
        message: status >= 500 ? 'Internal error.' : msg || 'Error',
      },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(cookie);

  // T1-041: request-id di semua respons; gunakan crypto.randomUUID untuk non-predictable ID.
  // P2 #15: simpan juga di req.id agar korelasi log ↔ metrics ↔ trace.
  app.addHook('onRequest', async (req, reply) => {
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    (req as { id?: string }).id = requestId;
    reply.header('x-request-id', requestId);
  });

  app.addHook('onResponse', async (req, reply) => {
    recordRequest(req.method, req.url, reply.statusCode, reply.elapsedTime);
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  });

  // --- Auth: Bearer → req.user (T1-003). Endpoint publik tetap bisa dibaca tanpa token. ---
  app.addHook('preHandler', async (req) => {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) {
      const ctx = await authenticate(getDb(), h.slice('Bearer '.length).trim());
      if (ctx) req.user = ctx;
    }
  });

  // --- Register Modular Route Plugins ---
  await app.register(systemRoutes);
  await app.register(authRoutes);
  await app.register(roomRoutes);
  await app.register(confessionRoutes);
  await app.register(whisperRoutes);
  await app.register(moderationRoutes);
  await app.register(zkRoutes);

  return app;
}
