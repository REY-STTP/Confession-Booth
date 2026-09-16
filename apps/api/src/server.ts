import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { config } from './config.js';
import { getDb } from './db/client.js';
import * as schema from './db/schema.js';
import {
  AuthError,
  authenticate,
  issueNonce,
  revokeToken,
  rotateRefresh,
  verifyAndLogin,
  type AuthContext,
} from './auth.js';
import { checkRateLimit, type RateAction } from './ratelimit.js';
import { withIdempotency } from './idempotency.js';
import { feedCacheGet, feedCacheSet, feedCacheInvalidate } from './cache.js';
import { getStorage } from './storage.js';
import { scoreAbuse } from './abuse.js';
import {
  canonicalHash,
  displayName,
  newDisplaySeed,
  newPublicId,
  onchainId,
  projectConfession,
  snippet,
  type ConfessionRow,
} from './content.js';
import {
  checkContent,
  isCategory,
  isReaction,
  isReason,
  CONFESSION_MAX,
  WHISPER_MAX,
} from './validate.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthContext;
  }
}

type Db = ReturnType<typeof getDb>;

function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

async function rateLimitOr429(
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

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const o = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof o?.createdAt === 'string' && typeof o?.id === 'string') {
      // T1-024: validasi tanggal ISO, tolak cursor rusak dengan 400 (bukan 500 PG).
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
function checkCsrf(req: FastifyRequest, reply: FastifyReply): boolean {
  const origin = req.headers.origin as string | undefined;
  // Reject requests with missing or null origin for cookie-based endpoints
  if (!origin || origin === 'null') {
    reply
      .code(403)
      .send({
        error: { code: 'FORBIDDEN', message: 'Origin header required for cookie endpoints.' },
      });
    return false;
  }
  try {
    const o = new URL(origin);
    const allowed = new Set(config.corsOrigin.map((s) => s.trim()).filter(Boolean));
    if (allowed.has('*')) return true;
    if (allowed.has(o.origin)) return true;
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Origin not allowed.' } });
    return false;
  } catch {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Invalid origin.' } });
    return false;
  }
}

/** T1-024: validasi format publicId `c_xxx`/`w_xxx` agar hemat DB hit. */
function isPublicIdFormat(v: string, prefix: 'c' | 'w' | 'any' = 'any'): boolean {
  if (v.length < 3 || v.length > 64) return false;
  if (prefix === 'any') return /^(c|w)_[A-Za-z0-9_-]+$/.test(v);
  return new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`).test(v);
}

const feedQuery = z.object({
  sort: z.enum(['new', 'trending', 'relatable']).default('new'),
  category: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).optional(),
  q: z.string().min(1).max(200).optional(),
  // T1H-003: midnight resmi = tag kategori `midnight` ATAU jam 00–04 WIB (server-side,
  // tanpa tracking lokasi user). Notifikasi push pasif ditunda (tanpa tracking agresif).
  slot: z.enum(['any', 'midnight']).default('any'),
});

const CRITICAL_REASONS = new Set(['THREAT', 'DOXXING', 'SEXUAL_EXPLOITATION']);

export async function buildApp(): Promise<FastifyInstance> {
  const bodyLimit = Number(process.env.BODY_LIMIT ?? 102_400);
  const app = Fastify({
    logger: true,
    bodyLimit,
    trustProxy: true,
    routerOptions: { maxParamLength: 128 },
  });

  // T1-024: error JSON konsisten, tanpa stack/HTML leak.
  app.setErrorHandler((err, _req, reply) => {
    const status =
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    if (status >= 500) app.log.error(err);
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
  // T1-041: request-id di semua respons; gunakan crypto.randomUUID untuk non-predictable ID
  // (tidak log body → isi confession/signature aman). Serializer redaksi header sensitif.
  app.addHook('onRequest', async (req, reply) => {
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    reply.header('x-request-id', requestId);
  });
  app.addHook('onResponse', async (req, reply) => {
    const { recordRequest } = await import('./metrics.js');
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

  function requireAuth(
    req: FastifyRequest,
    reply: FastifyReply,
  ): req is FastifyRequest & { user: AuthContext } {
    if (!req.user) {
      reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return false;
    }
    if (req.user.status !== 'ACTIVE') {
      reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Account restricted.' } });
      return false;
    }
    return true;
  }

  function requireRole(
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
    // JANGAN pernah expose RPC_URL / kunci di sini.
  }));

  // T1-041: metrics tanpa secret (tanpa isi confession/signature/IP mentah).
  app.get('/api/metrics', async () => {
    const { metricsSnapshot } = await import('./metrics.js');
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
  app.get('/api/slo', async () => {
    const { sloSnapshot } = await import('./metrics.js');
    return sloSnapshot();
  });

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

  const verifyBody = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .max(1000),
    nonce: z.string().min(16).max(128),
  });

  const refreshCookieOpts = {
    path: '/api/auth',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

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

  // --- Feed + detail (T1-011): hanya VISIBLE, proyeksi publik SCHEMA §17. ---
  async function reactionMap(db: Db, ids: string[]): Promise<Map<string, Record<string, number>>> {
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

  async function whisperCountMap(db: Db, ids: string[]): Promise<Map<string, number>> {
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

  app.get('/api/feed', async (req, reply) => {
    const parsed = feedQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid query.' } });
    }
    const { sort, category, limit, cursor, q, slot } = parsed.data;
    const db = getDb();
    const conds: ReturnType<typeof sql>[] = [sql`c.status = 'VISIBLE'`];
    if (category) conds.push(sql`cat.slug = ${category}`);
    if (slot === 'midnight') {
      conds.push(
        sql`(cat.slug = 'midnight' OR EXTRACT(HOUR FROM c.created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN 0 AND 4)`,
      );
    }
    // T1H-004: FTS dulu (tsvector simple + GIN), ILIKE+trigram sebagai recall fallback.
    // T1-024: escape LIKE wildcard + tolak q kosong (hindari full-scan ILIKE %%).
    let ftsRank: ReturnType<typeof sql> = sql`0`;
    if (q !== undefined) {
      const trimmed = q.trim();
      if (trimmed.length < 1) {
        return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Empty search.' } });
      }
      conds.push(
        sql`(c.body_tsv @@ plainto_tsquery('simple', ${trimmed}) OR c.body_text ILIKE ${'%' + escapeLike(trimmed) + '%'} ESCAPE '\\')`,
      );
      ftsRank = sql`ts_rank(c.body_tsv, plainto_tsquery('simple', ${trimmed}))`;
    }
    let cur: { createdAt: string; id: string } | null = null;
    if (cursor) {
      cur = decodeCursor(cursor);
      if (!cur) {
        return reply
          .code(400)
          .send({ error: { code: 'INVALID_CURSOR', message: 'Invalid cursor.' } });
      }
    }
    if (cur)
      conds.push(sql`(c.created_at, c.public_id) < (${cur.createdAt}::timestamptz, ${cur.id})`);
    const where = sql.join(conds, sql` AND `);

    // T1-030: cache memori 60s per kombinasi query (T1H-002: Redis bila REDIS_URL di-set).
    const cacheKey = `feed:${sort}:${category ?? ''}:${limit}:${cursor ?? ''}:${q ?? ''}:${slot}`;
    const cached = await feedCacheGet(cacheKey);
    if (cached) return cached as object;

    const rows = rowsOf<ConfessionRow & { id: string }>(
      await db.execute(sql`
        SELECT c.id, c.public_id, c.body_text, c.display_seed, c.status, c.created_at, cat.slug AS category,
               ${ftsRank} AS rank
        FROM confessions c
        JOIN categories cat ON cat.id = c.category_id
        LEFT JOIN feed_scores fs ON fs.confession_id = c.id AND fs.score_type = ${sort}
        WHERE ${where}
        ORDER BY rank DESC, fs.score DESC NULLS LAST, c.created_at DESC, c.public_id DESC
        LIMIT ${limit + 1}
      `),
    );
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);
    const [rmap, wmap] = await Promise.all([reactionMap(db, ids), whisperCountMap(db, ids)]);
    const items = page.map((r) => projectConfession(r, rmap.get(r.id) ?? {}, wmap.get(r.id) ?? 0));
    const last = page[page.length - 1];
    const out = {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor(new Date(last.created_at).toISOString(), last.public_id)
          : null,
    };
    await feedCacheSet(cacheKey, out);
    return out;
  });

  async function findConfession(db: Db, publicId: string) {
    const rows = rowsOf<ConfessionRow & { id: string }>(
      await db.execute(sql`
        SELECT c.id, c.public_id, c.body_text, c.display_seed, c.status, c.created_at, cat.slug AS category
        FROM confessions c JOIN categories cat ON cat.id = c.category_id
        WHERE c.public_id = ${publicId} LIMIT 1
      `),
    );
    return rows[0] ?? null;
  }

  app.get('/api/confessions/:publicId', async (req, reply) => {
    const { publicId } = req.params as { publicId: string };
    // T1-024: validasi format hemat DB hit.
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const db = getDb();
    const found = await findConfession(db, publicId);
    // Konten HIDDEN/REMOVED/QUARANTINED/PENDING → 404 netral (T1-011).
    if (!found || found.status !== 'VISIBLE') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const [rmap, wmap] = await Promise.all([
      reactionMap(db, [found.id]),
      whisperCountMap(db, [found.id]),
    ]);
    return projectConfession(found, rmap.get(found.id) ?? {}, wmap.get(found.id) ?? 0);
  });

  app.get('/api/confessions/:publicId/proof', async (req, reply) => {
    const { publicId } = req.params as { publicId: string };
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const db = getDb();
    const rows = rowsOf<{
      content_hash: string;
      transaction_hash: string | null;
      block_number: number | null;
      status: string;
      contract_address: string;
      chain_id: number;
    }>(
      await db.execute(sql`
        SELECT co.content_hash, p.transaction_hash, p.block_number, p.status,
               p.contract_address, p.chain_id
        FROM confessions c
        JOIN content_objects co ON co.id = c.content_object_id
        LEFT JOIN publications p ON p.confession_id = c.id
        WHERE c.public_id = ${publicId} LIMIT 1
      `),
    );
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    return {
      publicId,
      contentHash: row.content_hash,
      txHash: row.transaction_hash,
      blockNumber: row.block_number,
      status: row.status ?? 'PENDING_CHAIN',
      contractAddress: row.contract_address ?? (config.contractAddress || null),
      chainId: String(row.chain_id ?? config.chainId),
    };
  });

  // --- POST /confessions (T1-010): auth wajib, VISIBLE langsung, publikasi PENDING_CHAIN.
  // Zod max 2000 = guard body; aturan produk 500 ditegakkan checkContent (didokumentasikan T1-024). ---
  const confessBody = z.object({
    category: z.string().min(1).max(64),
    content: z.string().min(1).max(2000),
  });

  app.post('/api/confessions', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const userId = req.user!.id;

    const parsed = confessBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CONTENT', message: 'Invalid payload.' } });
    }
    const { category, content } = parsed.data;
    if (!isCategory(category)) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CATEGORY', message: 'Invalid category.' } });
    }
    const v = checkContent(content, CONFESSION_MAX);
    if (!v.ok) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CONTENT', message: v.errors.join(',') } });
    }
    if (!(await rateLimitOr429(reply, `user:${userId}`, 'confess'))) return;

    const cats = rowsOf<{ id: string }>(
      await db.execute(
        sql`SELECT id FROM categories WHERE slug = ${category} AND is_active = true LIMIT 1`,
      ),
    );
    if (!cats[0]) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CATEGORY', message: 'Unknown category.' } });
    }

    const contentHash = canonicalHash(content);
    const dup = rowsOf<{ one: number }>(
      await db.execute(sql`
        SELECT 1 AS one FROM confessions c
        JOIN content_objects co ON co.id = c.content_object_id
        WHERE c.author_user_id = ${userId}::uuid
          AND co.content_hash = ${contentHash}
          AND c.created_at > now() - interval '24 hours'
        LIMIT 1
      `),
    );
    if (dup.length > 0) {
      return reply
        .code(409)
        .send({ error: { code: 'CONTENT_DUPLICATE', message: 'Duplicate confession.' } });
    }

    const recent = rowsOf<{ n: string }>(
      await db.execute(sql`
        SELECT count(*) AS n FROM confessions
        WHERE author_user_id = ${userId}::uuid AND created_at > now() - interval '1 hour'
      `),
    );
    // T1H-005: sertakan report terbuka 24 jam terakhir agar akun bermasalah tereskalasi PoW.
    const openRep = rowsOf<{ n: string }>(
      await db.execute(sql`
        SELECT count(*) AS n FROM reports r
        JOIN confessions c ON c.id = r.target_id AND r.target_type = 'CONFESSION'
        WHERE c.author_user_id = ${userId}::uuid
          AND r.status IN ('OPEN', 'REVIEWING')
          AND r.created_at > now() - interval '24 hours'
      `),
    );
    const verdict = scoreAbuse({
      recentCount: Number(recent[0]?.n ?? 0),
      isDuplicate: false,
      openReports: Number(openRep[0]?.n ?? 0),
    });

    // T1H-005: eskalasi PoW saat abuse ambang (tanpa provider eksternal).
    if (verdict.flag) {
      const { verifyPowSolution, issuePowChallenge } = await import('./pow.js');
      const sol = req.headers['x-pow-solution'];
      if (typeof sol !== 'string' || !verifyPowSolution(sol)) {
        return reply.code(429).send({
          error: {
            code: 'POW_REQUIRED',
            message: 'Solve proof-of-work and retry.',
            challenge: issuePowChallenge(),
          },
        });
      }
    }

    const create = async () => {
      const publicId = newPublicId('c');
      const seed = newDisplaySeed();
      const now = new Date();
      const ref = await getStorage().put(contentHash, content);
      const created = await db.transaction(async (tx) => {
        const co = await tx
          .insert(schema.contentObjects)
          .values({ contentHash, storageProvider: ref.provider, storageCid: ref.cid })
          .onConflictDoNothing({ target: schema.contentObjects.contentHash })
          .returning({ id: schema.contentObjects.id });
        let coId = co[0]?.id;
        if (!coId) {
          const again = await tx
            .select({ id: schema.contentObjects.id })
            .from(schema.contentObjects)
            .where(eq(schema.contentObjects.contentHash, contentHash))
            .limit(1);
          coId = again[0].id;
        }
        const conf = await tx
          .insert(schema.confessions)
          .values({
            publicId,
            authorUserId: userId,
            categoryId: cats[0].id,
            contentObjectId: coId,
            bodyText: content,
            displaySeed: seed,
            status: 'VISIBLE',
            publishedAt: now,
            moderationScore: String(verdict.score),
          })
          .returning({ id: schema.confessions.id });
        await tx.insert(schema.publications).values({
          confessionId: conf[0].id,
          chainId: config.chainId,
          contractAddress: config.contractAddress || '0x0000000000000000000000000000000000000000',
          onchainConfessionId: onchainId(publicId),
          contentHash,
          status: 'PENDING_CHAIN',
          // submitted_at sengaja NULL: rantai belum pernah dicoba (publisher mengisinya).
        });
        return conf[0].id;
      });
      void created;
      return {
        statusCode: 201,
        body: {
          id: publicId,
          status: 'visible',
          publicId,
          author: { displayName: displayName(seed) },
        },
      };
    };

    const idemKey = req.headers['idempotency-key'];
    if (typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
      const r = await withIdempotency(db, userId, idemKey, create);
      return reply.code(r.statusCode).send(r.body);
    }
    const r = await create();
    return reply.code(r.statusCode).send(r.body);
  });

  // --- Reactions (T1-012): auth wajib, unik per user+type. ---
  const reactBody = z.object({ type: z.string().min(1).max(32) });

  app.post('/api/confessions/:publicId/reactions', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { publicId } = req.params as { publicId: string };
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const parsed = reactBody.safeParse(req.body);
    if (!parsed.success || !isReaction(parsed.data.type)) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_REACTION', message: 'Invalid reaction type.' } });
    }
    const db = getDb();
    const found = await findConfession(db, publicId);
    if (!found || found.status !== 'VISIBLE') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    if (!(await rateLimitOr429(reply, `user:${req.user!.id}`, 'react'))) return;

    const apply = async () => {
      const ins = await db
        .insert(schema.reactions)
        .values({
          confessionId: found.id,
          userId: req.user!.id,
          reactionType: parsed.data.type as 'UNDERSTAND' | 'LOVE' | 'SAD' | 'WILD' | 'FUNNY',
        })
        .onConflictDoNothing({
          target: [
            schema.reactions.confessionId,
            schema.reactions.userId,
            schema.reactions.reactionType,
          ],
        })
        .returning({ id: schema.reactions.id });
      return { statusCode: 200, body: { ok: true, reacted: ins.length > 0 } };
    };
    const idemKey = req.headers['idempotency-key'];
    if (typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
      // Idempotency reaksi di-scope per confession agar retry lintas target tidak bentrok.
      const r = await withIdempotency(db, req.user!.id, `${found.id}:${idemKey}`, apply);
      return reply.code(r.statusCode).send(r.body);
    }
    const r = await apply();
    return reply.code(r.statusCode).send(r.body);
  });

  app.delete('/api/confessions/:publicId/reactions/:type', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { publicId, type } = req.params as { publicId: string; type: string };
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    if (!isReaction(type)) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_REACTION', message: 'Invalid reaction type.' } });
    }
    const db = getDb();
    const found = await findConfession(db, publicId);
    if (!found)
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    await db
      .delete(schema.reactions)
      .where(
        and(
          eq(schema.reactions.confessionId, found.id),
          eq(schema.reactions.userId, req.user!.id),
          eq(schema.reactions.reactionType, type as 'UNDERSTAND'),
        ),
      );
    return { ok: true };
  });

  // --- Whispers (T1-013). ---
  app.get('/api/confessions/:publicId/whispers', async (req, reply) => {
    const { publicId } = req.params as { publicId: string };
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().min(1).max(512).optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid query.' } });
    }
    const db = getDb();
    const found = await findConfession(db, publicId);
    if (!found || found.status !== 'VISIBLE') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    let cur: { createdAt: string; id: string } | null = null;
    if (parsed.data.cursor) {
      cur = decodeCursor(parsed.data.cursor);
      if (!cur) {
        return reply
          .code(400)
          .send({ error: { code: 'INVALID_CURSOR', message: 'Invalid cursor.' } });
      }
    }
    const conds = [sql`w.confession_id = ${found.id}::uuid`, sql`w.status = 'VISIBLE'`];
    if (cur)
      conds.push(sql`(w.created_at, w.public_id) > (${cur.createdAt}::timestamptz, ${cur.id})`);
    const rows = rowsOf<{
      public_id: string;
      body_text: string;
      display_seed: number;
      created_at: Date;
    }>(
      await db.execute(sql`
        SELECT w.public_id, w.body_text, w.display_seed, w.created_at FROM whispers w
        WHERE ${sql.join(conds, sql` AND `)}
        ORDER BY w.created_at ASC, w.public_id ASC LIMIT ${parsed.data.limit + 1}
      `),
    );
    const page = rows.slice(0, parsed.data.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((w) => ({
        id: w.public_id,
        author: { displayName: displayName(w.display_seed) },
        content: w.body_text,
        createdAt: new Date(w.created_at).toISOString(),
      })),
      nextCursor:
        rows.length > parsed.data.limit && last
          ? encodeCursor(new Date(last.created_at).toISOString(), last.public_id)
          : null,
    };
  });

  const whisperBody = z.object({ content: z.string().min(1).max(2000) });

  app.post('/api/confessions/:publicId/whispers', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { publicId } = req.params as { publicId: string };
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const parsed = whisperBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CONTENT', message: 'Invalid payload.' } });
    }
    const v = checkContent(parsed.data.content, WHISPER_MAX);
    if (!v.ok) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CONTENT', message: v.errors.join(',') } });
    }
    const db = getDb();
    const userId = req.user!.id;
    const found = await findConfession(db, publicId);
    if (!found || found.status !== 'VISIBLE') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    if (!(await rateLimitOr429(reply, `user:${userId}`, 'whisper'))) return;

    const contentHash = canonicalHash(parsed.data.content);
    const dup = rowsOf<{ one: number }>(
      await db.execute(sql`
        SELECT 1 AS one FROM whispers w
        JOIN content_objects co ON co.id = w.content_object_id
        WHERE w.author_user_id = ${userId}::uuid AND w.confession_id = ${found.id}::uuid
          AND co.content_hash = ${contentHash}
          AND w.created_at > now() - interval '24 hours'
        LIMIT 1
      `),
    );
    if (dup.length > 0) {
      return reply
        .code(409)
        .send({ error: { code: 'CONTENT_DUPLICATE', message: 'Duplicate whisper.' } });
    }

    const create = async () => {
      const wid = newPublicId('w');
      const seed = newDisplaySeed();
      const ref = await getStorage().put(contentHash, parsed.data.content);
      await db.transaction(async (tx) => {
        const co = await tx
          .insert(schema.contentObjects)
          .values({ contentHash, storageProvider: ref.provider, storageCid: ref.cid })
          .onConflictDoNothing({ target: schema.contentObjects.contentHash })
          .returning({ id: schema.contentObjects.id });
        let coId = co[0]?.id;
        if (!coId) {
          const again = await tx
            .select({ id: schema.contentObjects.id })
            .from(schema.contentObjects)
            .where(eq(schema.contentObjects.contentHash, contentHash))
            .limit(1);
          coId = again[0].id;
        }
        await tx.insert(schema.whispers).values({
          publicId: wid,
          confessionId: found.id,
          authorUserId: userId,
          contentObjectId: coId,
          bodyText: parsed.data.content,
          displaySeed: seed,
          status: 'VISIBLE',
          publishedAt: new Date(),
        });
      });
      return { statusCode: 201, body: { id: wid, status: 'visible' } };
    };
    const idemKey = req.headers['idempotency-key'];
    if (typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
      const r = await withIdempotency(db, userId, `${found.id}:${idemKey}`, create);
      return reply.code(r.statusCode).send(r.body);
    }
    const r = await create();
    return reply.code(r.statusCode).send(r.body);
  });

  // --- Reports (T1-014): pelapor boleh anonim. T1-024/027: details max 500 via shared, throttle per-target. ---
  const reportBody = z.object({
    targetType: z.enum(['CONFESSION', 'WHISPER']),
    targetId: z
      .string()
      .regex(/^(c|w)_[A-Za-z0-9_-]+$/)
      .min(3)
      .max(64),
    reason: z.string().min(1).max(32),
    details: z.string().max(500).optional(),
  });

  app.post('/api/reports', async (req, reply) => {
    const parsed = reportBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_REPORT', message: 'Invalid report.' } });
    }
    const { targetType, targetId, reason, details } = parsed.data;
    if (!isReason(reason)) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_REPORT', message: 'Unknown reason.' } });
    }
    if (details !== undefined) {
      const { validateReportDetails } = await import('./validate.js');
      const vd = validateReportDetails(details);
      if (!vd.ok) {
        return reply
          .code(400)
          .send({ error: { code: 'INVALID_REPORT', message: vd.errors.join(',') } });
      }
    }
    const db = getDb();
    const reporterId = req.user?.id ?? null;
    const subject = reporterId ? `user:${reporterId}` : `ip:${req.ip}`;
    if (!(await rateLimitOr429(reply, subject, 'report'))) return;

    const target = rowsOf<{ id: string; status: string }>(
      targetType === 'CONFESSION'
        ? await db.execute(
            sql`SELECT id, status FROM confessions WHERE public_id = ${targetId} LIMIT 1`,
          )
        : await db.execute(
            sql`SELECT id, status FROM whispers WHERE public_id = ${targetId} LIMIT 1`,
          ),
    )[0];
    if (!target) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Target not found.' } });
    }

    // T1-027: throttle spam report sama (subject sama → target sama dalam 10 mnt).
    const recentDup = rowsOf<{ one: number }>(
      reporterId
        ? await db.execute(sql`
          SELECT 1 AS one FROM reports
          WHERE reporter_user_id = ${reporterId}::uuid AND target_id = ${target.id}::uuid
            AND created_at > now() - interval '10 minutes' LIMIT 1
        `)
        : await db.execute(sql`
          SELECT 1 AS one FROM reports
          WHERE reporter_user_id IS NULL AND target_id = ${target.id}::uuid
            AND reason_code = ${reason} AND created_at > now() - interval '10 minutes' LIMIT 1
        `),
    );
    if (recentDup.length > 0) {
      return reply
        .code(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Already reported recently.' } });
    }

    const ins = rowsOf<{ id: string }>(
      await db.execute(sql`
        INSERT INTO reports (reporter_user_id, target_type, target_id, reason_code, details, status)
        VALUES (${reporterId}::uuid, ${targetType}::report_target, ${target.id}::uuid, ${reason}, ${details ?? null}, 'OPEN')
        RETURNING id
      `),
    );

    // Triage otomatis: konten kritis → QUARANTINED sementara + skor naik (MODERATION §4).
    // T1-027: cap skor 0..100 agar +25 tidak overflow.
    if (CRITICAL_REASONS.has(reason)) {
      if (targetType === 'CONFESSION') {
        await db.execute(sql`
          UPDATE confessions SET status = 'QUARANTINED', moderation_score = LEAST(100, moderation_score + 25)
          WHERE id = ${target.id}::uuid AND status = 'VISIBLE'
        `);
      } else {
        await db.execute(
          sql`UPDATE whispers SET status = 'QUARANTINED' WHERE id = ${target.id}::uuid AND status = 'VISIBLE'`,
        );
      }
      feedCacheInvalidate(); // T1-030 (async T1H-002: Redis bila ada)
    }

    return reply.code(201).send({ id: ins[0].id, status: 'OPEN' });
  });

  // --- Moderasi (T1-015): audit penuh, tanpa catatan ke on-chain. ---
  app.get('/api/moderation/queue', async (req, reply) => {
    if (!requireRole(req, reply, 'MODERATOR', 'ADMIN')) return;
    const parsed = z
      .object({
        status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']).default('OPEN'),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid query.' } });
    }
    const db = getDb();
    const reps = rowsOf<{
      id: string;
      target_type: string;
      target_id: string;
      reason_code: string;
      status: string;
      created_at: Date;
    }>(
      await db.execute(sql`
        SELECT id, target_type, target_id, reason_code, status, created_at FROM reports
        WHERE status = ${parsed.data.status}::report_status
        ORDER BY created_at ASC LIMIT ${parsed.data.limit}
      `),
    );
    const items = [];
    for (const r of reps) {
      const t =
        r.target_type === 'CONFESSION'
          ? rowsOf<{ public_id: string; body_text: string; status: string }>(
              await db.execute(
                sql`SELECT public_id, body_text, status FROM confessions WHERE id = ${r.target_id}::uuid LIMIT 1`,
              ),
            )[0]
          : rowsOf<{ public_id: string; body_text: string; status: string }>(
              await db.execute(
                sql`SELECT public_id, body_text, status FROM whispers WHERE id = ${r.target_id}::uuid LIMIT 1`,
              ),
            )[0];
      items.push({
        reportId: r.id,
        targetType: r.target_type,
        targetPublicId: t?.public_id ?? null,
        targetStatus: t?.status ?? null,
        reason: r.reason_code,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        preview: t ? snippet(t.body_text) : null,
      });
    }
    return { items, nextCursor: null };
  });

  const modActionBody = z.object({
    targetType: z.enum(['CONFESSION', 'WHISPER']),
    targetId: z
      .string()
      .regex(/^(c|w)_[A-Za-z0-9_-]+$/)
      .min(3)
      .max(64),
    action: z.enum(['DISMISS', 'HIDE', 'REMOVE', 'RESTRICT', 'BAN', 'RESTORE']),
    reason_code: z.string().min(1).max(32),
    notes: z.string().max(2000).optional(),
    policy_version: z.string().min(1).max(32),
  });

  app.post('/api/moderation/actions', async (req, reply) => {
    if (!requireRole(req, reply, 'MODERATOR', 'ADMIN')) return;
    const parsed = modActionBody.safeParse(req.body);
    if (!parsed.success || !isReason(parsed.data.reason_code)) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_ACTION', message: 'Invalid moderation action.' } });
    }
    const { targetType, targetId, action, reason_code, notes, policy_version } = parsed.data;
    const db = getDb();
    const target =
      targetType === 'CONFESSION'
        ? await db
            .select({
              id: schema.confessions.id,
              status: schema.confessions.status,
              authorUserId: schema.confessions.authorUserId,
            })
            .from(schema.confessions)
            .where(eq(schema.confessions.publicId, targetId))
            .limit(1)
            .then((r) => r[0])
        : await db
            .select({
              id: schema.whispers.id,
              status: schema.whispers.status,
              authorUserId: schema.whispers.authorUserId,
            })
            .from(schema.whispers)
            .where(eq(schema.whispers.publicId, targetId))
            .limit(1)
            .then((r) => r[0]);
    if (!target) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Target not found.' } });
    }

    await db.transaction(async (tx) => {
      if (targetType === 'CONFESSION') {
        if (action === 'HIDE' || action === 'REMOVE') {
          await tx
            .update(schema.confessions)
            .set({ status: action === 'HIDE' ? 'HIDDEN' : 'REMOVED', hiddenAt: new Date() })
            .where(eq(schema.confessions.id, target.id));
        } else if (action === 'RESTORE') {
          // T1-027: jangan bump publishedAt (hindari moderator boost feed).
          await tx
            .update(schema.confessions)
            .set({ status: 'VISIBLE', hiddenAt: null })
            .where(eq(schema.confessions.id, target.id));
        }
      } else {
        if (action === 'HIDE' || action === 'REMOVE') {
          await tx
            .update(schema.whispers)
            .set({ status: action === 'HIDE' ? 'HIDDEN' : 'REMOVED' })
            .where(eq(schema.whispers.id, target.id));
        } else if (action === 'RESTORE') {
          await tx
            .update(schema.whispers)
            .set({ status: 'VISIBLE' })
            .where(eq(schema.whispers.id, target.id));
        }
      }
      if (action === 'RESTRICT' || action === 'BAN') {
        await tx
          .update(schema.users)
          .set({ status: action === 'BAN' ? 'BANNED' : 'RESTRICTED' })
          .where(eq(schema.users.id, target.authorUserId));
      }
      await tx.insert(schema.moderationActions).values({
        moderatorUserId: req.user!.id,
        targetType,
        targetId: target.id,
        action,
        reasonCode: reason_code,
        notes: notes ?? null,
        policyVersion: policy_version,
      });
      await tx
        .update(schema.reports)
        .set({ status: action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', resolvedAt: new Date() })
        .where(and(eq(schema.reports.targetId, target.id), eq(schema.reports.status, 'OPEN')));
      await tx
        .update(schema.reports)
        .set({ status: action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', resolvedAt: new Date() })
        .where(and(eq(schema.reports.targetId, target.id), eq(schema.reports.status, 'REVIEWING')));
    });

    feedCacheInvalidate(); // T1-030: hide/remove/restore/ban langsung terlihat <5s
    return { ok: true };
  });

  // T1-042: bootstrap role pertama tanpa raw SQL. Dilindungi ADMIN_SECRET server-only
  // (header x-admin-secret). Tanpa ADMIN_SECRET di env → 503. Rate-limit + audit log.
  // MFA admin penuh (TOTP) dijadwalkan hosting/IdP; di sini minimal secret + audit.
  app.post('/api/admin/grant-role', async (req, reply) => {
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'admin'))) return;
    const secret = process.env.ADMIN_SECRET ?? '';
    if (!secret) {
      return reply
        .code(503)
        .send({ error: { code: 'ADMIN_DISABLED', message: 'Admin bootstrap disabled.' } });
    }
    const got = req.headers['x-admin-secret'];
    if (got !== secret) {
      return reply
        .code(403)
        .send({ error: { code: 'FORBIDDEN', message: 'Invalid admin secret.' } });
    }
    const parsed = z
      .object({
        wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        role: z.enum(['MODERATOR', 'ADMIN']),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_ROLE', message: 'Invalid wallet/role.' } });
    }
    const db = getDb();
    const updated = rowsOf<{ id: string }>(
      await db.execute(sql`
        UPDATE users SET role = ${parsed.data.role} WHERE wallet_address = ${parsed.data.wallet.toLowerCase()}
        RETURNING id
      `),
    );
    if (updated.length === 0) {
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'User not found. Login once first.' } });
    }
    req.log.info({ op: 'grant-role', role: parsed.data.role });
    return { ok: true };
  });

  return app;
}
