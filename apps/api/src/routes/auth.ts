import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { AuthError, issueNonce, rotateRefresh, revokeToken, verifyAndLogin } from '../auth.js';
import { rateLimitOr429, checkCsrf, refreshCookieOpts, requireAuth, rowsOf } from './common.js';

const verifyBody = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .max(1000),
  nonce: z.string().min(16).max(128),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // --- Auth nyata T1-002 (SIWE-style challenge + sesi). T1-023: address wajib, chainId allowlist. ---
  app.get('/api/auth/nonce', async (req, reply) => {
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'nonce'))) return;
    const parsed = z
      .object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        chainId: z.coerce.number().int().positive().safe().optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_ADDRESS', message: 'Valid wallet address required.' } });
    }
    const { address, chainId } = parsed.data;
    try {
      return await issueNonce(getDb(), { address, chainId });
    } catch (e) {
      if (e instanceof AuthError)
        return reply.code(e.status).send({ error: { code: e.code, message: e.message } });
      throw e;
    }
  });

  app.post('/api/auth/verify', async (req, reply) => {
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'verify'))) return;
    const parsed = verifyBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_AUTH', message: 'Invalid credentials.' } });
    }
    try {
      const s = await verifyAndLogin(getDb(), parsed.data);
      reply.setCookie('booth_refresh', s.refreshToken, {
        ...refreshCookieOpts,
        expires: new Date(s.refreshExpiresAt),
      });
      return { authenticated: true, accessToken: s.accessToken, expiresAt: s.accessExpiresAt };
    } catch (e) {
      if (e instanceof AuthError)
        return reply.code(e.status).send({ error: { code: e.code, message: e.message } });
      throw e;
    }
  });

  app.post('/api/auth/refresh', async (req, reply) => {
    if (!checkCsrf(req, reply)) return;
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'refresh'))) return;
    const raw = req.cookies['booth_refresh'];
    if (!raw)
      return reply
        .code(401)
        .send({ error: { code: 'INVALID_REFRESH', message: 'Missing refresh token.' } });
    try {
      const s = await rotateRefresh(getDb(), raw);
      reply.setCookie('booth_refresh', s.refreshToken, {
        ...refreshCookieOpts,
        expires: new Date(s.refreshExpiresAt),
      });
      return { authenticated: true, accessToken: s.accessToken, expiresAt: s.accessExpiresAt };
    } catch (e) {
      if (e instanceof AuthError)
        return reply.code(e.status).send({ error: { code: e.code, message: e.message } });
      throw e;
    }
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (!checkCsrf(req, reply)) return;
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'logout'))) return;
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) await revokeToken(getDb(), h.slice('Bearer '.length).trim());
    const raw = req.cookies['booth_refresh'];
    if (raw) await revokeToken(getDb(), raw);
    reply.clearCookie('booth_refresh', { ...refreshCookieOpts });
    return { ok: true };
  });

  // --- T3-002: Badges & Reputation API ---
  app.get('/api/me/badges', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const rows = rowsOf<{ badge_type: string; awarded_at: Date }>(
      await db.execute(
        sql`SELECT badge_type, awarded_at FROM user_badges WHERE user_id = ${req.user!.id}::uuid ORDER BY awarded_at ASC`,
      ),
    );
    return {
      badges: rows.map((r) => ({
        type: r.badge_type,
        awardedAt: new Date(r.awarded_at).toISOString(),
      })),
    };
  });
};
