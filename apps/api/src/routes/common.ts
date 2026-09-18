import type { FastifyReply, FastifyRequest } from 'fastify';
import { sql } from 'drizzle-orm';
// P1 #11: feedQuery dari SSOT shared (diimpor ulang agar import-site tak berubah).
import { feedQuerySchema } from '@booth/shared';
import { config } from '../config.js';
import { getDb } from '../db/client.js';
import { checkRateLimit, type RateAction } from '../ratelimit.js';
import type { AuthContext } from '../auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthContext;
  }
}

export type Db = ReturnType<typeof getDb>;

export function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

export async function rateLimitOr429(
  reply: FastifyReply,
  subject: string,
  action: RateAction,
): Promise<boolean> {
  const r = await checkRateLimit(getDb(), subject, action);
  if (!r.ok) {
    reply.header('Retry-After', String(r.retryAfterSec));
    reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } });
    return false;
  }
  return true;
}

export function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): req is FastifyRequest & { user: AuthContext } {
  if (!req.user) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    return false;
  }
  if (req.user.status !== 'ACTIVE') {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Account restricted.' } });
    return false;
  }
  return true;
}

export function requireRole(
  req: FastifyRequest,
  reply: FastifyReply,
  ...roles: AuthContext['role'][]
): req is FastifyRequest & { user: AuthContext } {
  if (!requireAuth(req, reply)) return false;
  if (!roles.includes(req.user!.role)) {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient role.' } });
    return false;
  }
  return true;
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const o = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof o?.createdAt === 'string' && typeof o?.id === 'string') {
      const t = Date.parse(o.createdAt);
      if (!Number.isFinite(t)) return null;
      if (o.id.length < 1 || o.id.length > 128) return null;
      return o;
    }
    return null;
  } catch {
    return null;
  }
}

/** T1-024: escape wildcard LIKE agar `%`/`_`/`\` user tidak jadi full-scan/over-match. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** T1-023: CSRF origin-check untuk endpoint cookie (refresh/logout). */
export function checkCsrf(req: FastifyRequest, reply: FastifyReply): boolean {
  const origin = req.headers.origin as string | undefined;
  if (!origin || origin === 'null') {
    reply.code(403).send({
      error: { code: 'FORBIDDEN', message: 'Origin header required for cookie endpoints.' },
    });
    return false;
  }
  try {
    const o = new URL(origin);
    // P1 #6: tanpa shortcut '*' — origin harus eksplisit terdaftar.
    // (config menolak '*' + credentials di production saat boot.)
    const allowed = new Set(config.corsOrigin.map((s) => s.trim()).filter(Boolean));
    if (allowed.has(o.origin)) return true;
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Origin not allowed.' } });
    return false;
  } catch {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Invalid origin.' } });
    return false;
  }
}

/** T1-024: validasi format publicId `c_xxx`/`w_xxx` agar hemat DB hit. */
export function isPublicIdFormat(v: string, prefix: 'c' | 'w' | 'any' = 'any'): boolean {
  if (v.length < 3 || v.length > 64) return false;
  if (prefix === 'any') return /^(c|w)_[A-Za-z0-9_-]+$/.test(v);
  return new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`).test(v);
}

// --- T3-002: Anonymous Badges & Reputation helper ---
export async function checkAndAwardBadge(
  db: Db,
  userId: string,
  badgeType: string,
): Promise<boolean> {
  try {
    const existing = rowsOf<{ id: string }>(
      await db.execute(
        sql`SELECT id FROM user_badges WHERE user_id = ${userId}::uuid AND badge_type = ${badgeType} LIMIT 1`,
      ),
    );
    if (existing.length > 0) return false;

    let eligible = false;
    if (badgeType === 'EMPATHETIC_LISTENER') {
      const cnt = rowsOf<{ n: string }>(
        await db.execute(
          sql`SELECT count(*) AS n FROM reactions WHERE user_id = ${userId}::uuid AND reaction_type IN ('UNDERSTAND', 'LOVE')`,
        ),
      );
      eligible = Number(cnt[0]?.n ?? 0) >= 3;
    } else if (badgeType === 'MIDNIGHT_SOUL') {
      const nowH = new Date().getUTCHours() + 7; // WIB (UTC+7)
      const h = nowH % 24;
      eligible = h >= 0 && h < 4;
    } else if (badgeType === 'CHAIN_WEAVER') {
      const cnt = rowsOf<{ n: string }>(
        await db.execute(
          sql`SELECT count(*) AS n FROM whispers WHERE author_user_id = ${userId}::uuid`,
        ),
      );
      eligible = Number(cnt[0]?.n ?? 0) >= 2;
    } else if (badgeType === 'STEALTH_CONFESSOR') {
      eligible = true;
    }

    if (eligible) {
      await db.execute(
        sql`INSERT INTO user_badges (user_id, badge_type) VALUES (${userId}::uuid, ${badgeType}) ON CONFLICT (user_id, badge_type) DO NOTHING`,
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function reactionMap(
  db: Db,
  ids: string[],
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (ids.length === 0) return map;
  const rows = rowsOf<{ confession_id: string; reaction_type: string; n: string }>(
    await db.execute(sql`
      SELECT confession_id, reaction_type, count(*) AS n
      FROM reactions WHERE confession_id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) GROUP BY 1, 2
    `),
  );
  for (const r of rows) {
    const e = map.get(r.confession_id) ?? {};
    e[r.reaction_type] = Number(r.n);
    map.set(r.confession_id, e);
  }
  return map;
}

export async function whisperCountMap(db: Db, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = rowsOf<{ confession_id: string; n: string }>(
    await db.execute(sql`
      SELECT confession_id, count(*) AS n FROM whispers
      WHERE confession_id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) AND status = 'VISIBLE' GROUP BY 1
    `),
  );
  for (const r of rows) map.set(r.confession_id, Number(r.n));
  return map;
}

export const feedQuery = feedQuerySchema;

export const CRITICAL_REASONS = new Set(['THREAT', 'DOXXING', 'SEXUAL_EXPLOITATION']);

// P2 #15: throttle baca anti-scraping/enumerasi. Loopback dikecualikan
// (tooling lokal/healthcheck tepercaya) — selain itu semua IP dihitung.
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export async function rateLimitReadOr429(
  reply: FastifyReply,
  req: FastifyRequest,
): Promise<boolean> {
  if (LOOPBACK_IPS.has(req.ip)) return true;
  return rateLimitOr429(reply, `ip:${req.ip}`, 'read');
}

export const refreshCookieOpts = {
  path: '/api/auth',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // P2 #15: Strict (refresh hanya dipakai fetch same-origin).
  // __Host- disengaja TIDAK dipakai: mensyaratkan Path=/ + Secure selalu,
  // yang mem widen scope cookie dan merusak dev http lokal.
  sameSite: 'strict' as const,
};
