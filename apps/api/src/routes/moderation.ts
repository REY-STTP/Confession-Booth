import type { FastifyPluginAsync } from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import { config } from '../config.js';
import { feedCacheInvalidate } from '../cache.js';
import { snippet } from '../content.js';
import { AuthError } from '../auth.js';
import { isReason } from '../validate.js';
import { rowsOf, rateLimitOr429, requireRole, CRITICAL_REASONS } from './common.js';
import { withIdempotency } from '../idempotency.js';

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

const modActionBody = z.object({
  targetType: z.enum(['CONFESSION', 'WHISPER']),
  targetId: z
    .string()
    .regex(/^(c|w)_[A-Za-z0-9_-]+$/)
    .min(3)
    .max(64),
  // P1 #9: UNBAN/UNRESTRICT mengembalikan status user ke ACTIVE.
  action: z.enum([
    'DISMISS',
    'HIDE',
    'REMOVE',
    'RESTRICT',
    'BAN',
    'RESTORE',
    'UNBAN',
    'UNRESTRICT',
  ]),
  reason_code: z.string().min(1).max(32),
  notes: z.string().max(2000).optional(),
  policy_version: z.string().min(1).max(32),
});

export const moderationRoutes: FastifyPluginAsync = async (app) => {
  // --- Reports (T1-014) ---
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
      const { validateReportDetails } = await import('../validate.js');
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

    // P1 #9: throttle anonim per-IP-hash — satu anon tidak bisa memblokir
    // semua anon lain untuk target+reason yang sama.
    const reporterIpHash = reporterId
      ? null
      : createHash('sha256').update(`booth-report:${req.ip}`, 'utf8').digest('hex');
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
            AND reason_code = ${reason} AND reporter_ip_hash = ${reporterIpHash}
            AND created_at > now() - interval '10 minutes' LIMIT 1
        `),
    );
    if (recentDup.length > 0) {
      return reply
        .code(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Already reported recently.' } });
    }

    const submit = async (): Promise<{ statusCode: number; body: unknown }> => {
      const ins = rowsOf<{ id: string }>(
        await db.execute(sql`
        INSERT INTO reports (reporter_user_id, reporter_ip_hash, target_type, target_id, reason_code, details, status)
        VALUES (${reporterId}::uuid, ${reporterIpHash}, ${targetType}::report_target, ${target.id}::uuid, ${reason}, ${details ?? null}, 'OPEN')
        RETURNING id
      `),
      );

      // Triage otomatis: konten kritis → QUARANTINED sementara + skor naik (MODERATION §4).
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
        await feedCacheInvalidate().catch((err) =>
          app.log.error(err, 'feedCacheInvalidate failed'),
        );
      }

      return { statusCode: 201, body: { id: ins[0].id, status: 'OPEN' } };
    };

    // P2 #17: dedup retry untuk pelapor terautentikasi (anon: throttle per-IP di atas).
    const idemKey = req.headers['idempotency-key'];
    if (reporterId && typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
      const r = await withIdempotency(
        db,
        reporterId,
        `report:${target.id}:${reason}:${idemKey}`,
        submit,
      );
      return reply.code(r.statusCode).send(r.body);
    }
    const r = await submit();
    return reply.code(r.statusCode).send(r.body);
  });

  // --- Moderasi (T1-015) ---
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
    // AUDIT PERF-002: batch query instead of N+1
    const confIds = reps.filter((r) => r.target_type === 'CONFESSION').map((r) => r.target_id);
    const whispIds = reps.filter((r) => r.target_type === 'WHISPER').map((r) => r.target_id);
    const targetMap = new Map<string, { public_id: string; body_text: string; status: string }>();
    if (confIds.length > 0) {
      const cRows = rowsOf<{ id: string; public_id: string; body_text: string; status: string }>(
        await db.execute(
          sql`SELECT id, public_id, body_text, status FROM confessions WHERE id IN (${sql.join(
            confIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      );
      for (const c of cRows) targetMap.set(c.id, c);
    }
    if (whispIds.length > 0) {
      const wRows = rowsOf<{ id: string; public_id: string; body_text: string; status: string }>(
        await db.execute(
          sql`SELECT id, public_id, body_text, status FROM whispers WHERE id IN (${sql.join(
            whispIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      );
      for (const w of wRows) targetMap.set(w.id, w);
    }
    const items = reps.map((r) => {
      const t = targetMap.get(r.target_id);
      return {
        reportId: r.id,
        targetType: r.target_type,
        targetPublicId: t?.public_id ?? null,
        targetStatus: t?.status ?? null,
        reason: r.reason_code,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        preview: t ? snippet(t.body_text) : null,
      };
    });
    return { items, nextCursor: null };
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

    try {
      await db.transaction(async (tx) => {
        if (targetType === 'CONFESSION') {
          if (action === 'HIDE' || action === 'REMOVE') {
            await tx
              .update(schema.confessions)
              .set({ status: action === 'HIDE' ? 'HIDDEN' : 'REMOVED', hiddenAt: new Date() })
              .where(eq(schema.confessions.id, target.id));
          } else if (action === 'RESTORE') {
            // P1 #9: RESTORE hanya dari HIDDEN/QUARANTINED — jangan hidupkan
            // putusan final REMOVED atau konten PENDING.
            const restored = await tx
              .update(schema.confessions)
              .set({ status: 'VISIBLE', hiddenAt: null })
              .where(
                and(
                  eq(schema.confessions.id, target.id),
                  inArray(schema.confessions.status, ['HIDDEN', 'QUARANTINED']),
                ),
              )
              .returning({ id: schema.confessions.id });
            if (restored.length === 0) {
              throw new AuthError('INVALID_TRANSITION', 'Target cannot be restored.', 409);
            }
          }
        } else {
          if (action === 'HIDE' || action === 'REMOVE') {
            await tx
              .update(schema.whispers)
              .set({ status: action === 'HIDE' ? 'HIDDEN' : 'REMOVED' })
              .where(eq(schema.whispers.id, target.id));
          } else if (action === 'RESTORE') {
            const restored = await tx
              .update(schema.whispers)
              .set({ status: 'VISIBLE' })
              .where(
                and(
                  eq(schema.whispers.id, target.id),
                  inArray(schema.whispers.status, ['HIDDEN', 'QUARANTINED']),
                ),
              )
              .returning({ id: schema.whispers.id });
            if (restored.length === 0) {
              throw new AuthError('INVALID_TRANSITION', 'Target cannot be restored.', 409);
            }
          }
        }
        if ((action === 'RESTRICT' || action === 'BAN') && target.authorUserId) {
          await tx
            .update(schema.users)
            .set({ status: action === 'BAN' ? 'BANNED' : 'RESTRICTED' })
            .where(eq(schema.users.id, target.authorUserId));
        }
        // P1 #9: UNBAN/UNRESTRICT mengembalikan akun ke ACTIVE.
        if ((action === 'UNBAN' || action === 'UNRESTRICT') && target.authorUserId) {
          await tx
            .update(schema.users)
            .set({ status: 'ACTIVE' })
            .where(eq(schema.users.id, target.authorUserId));
        }
        // P1 #9: enum kolom mod_action tak mengenal UNBAN/UNRESTRICT (tanpa migrasi
        // enum) — audit dicatat sebagai RESTORE dengan notes eksplisit.
        const auditAction = action === 'UNBAN' || action === 'UNRESTRICT' ? 'RESTORE' : action;
        const auditNotes =
          action === 'UNBAN' || action === 'UNRESTRICT'
            ? `${action} account via moderation API${notes ? `: ${notes}` : ''}`.slice(0, 2000)
            : (notes ?? null);
        await tx.insert(schema.moderationActions).values({
          moderatorUserId: req.user!.id,
          targetType,
          targetId: target.id,
          action: auditAction,
          reasonCode: reason_code,
          notes: auditNotes,
          policyVersion: policy_version,
        });
        // P1 #9: resolve hanya laporan dengan reason yang ditindak — bukan semua
        // reason untuk target yang sama.
        await tx
          .update(schema.reports)
          .set({ status: action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', resolvedAt: new Date() })
          .where(
            and(
              eq(schema.reports.targetId, target.id),
              eq(schema.reports.status, 'OPEN'),
              eq(schema.reports.reasonCode, reason_code),
            ),
          );
        await tx
          .update(schema.reports)
          .set({ status: action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', resolvedAt: new Date() })
          .where(
            and(
              eq(schema.reports.targetId, target.id),
              eq(schema.reports.status, 'REVIEWING'),
              eq(schema.reports.reasonCode, reason_code),
            ),
          );
      });
    } catch (e) {
      if (e instanceof AuthError && e.code === 'INVALID_TRANSITION') {
        return reply
          .code(409)
          .send({ error: { code: 'INVALID_TRANSITION', message: 'Target cannot be restored.' } });
      }
      throw e;
    }

    await feedCacheInvalidate().catch((err) => app.log.error(err, 'feedCacheInvalidate failed'));
    return { ok: true };
  });

  // T1-042: bootstrap role pertama tanpa raw SQL. Dilindungi ADMIN_SECRET server-only.
  // P0 #3: compare timing-safe, secret min 32 char, audit DB, bisa dimatikan pasca-bootstrap.
  app.post('/api/admin/grant-role', async (req, reply) => {
    if (process.env.ADMIN_GRANT_ENABLED === 'false') {
      return reply
        .code(503)
        .send({ error: { code: 'ADMIN_DISABLED', message: 'Admin bootstrap disabled.' } });
    }
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'admin'))) return;
    const secret = process.env.ADMIN_SECRET ?? '';
    if (!secret || secret.length < 32) {
      return reply
        .code(503)
        .send({ error: { code: 'ADMIN_DISABLED', message: 'Admin bootstrap disabled.' } });
    }
    const got = req.headers['x-admin-secret'];
    const ok =
      typeof got === 'string' &&
      got.length === secret.length &&
      timingSafeEqual(Buffer.from(got, 'utf8'), Buffer.from(secret, 'utf8'));
    if (!ok) {
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
    const chainId = config.chainId;
    await db.execute(sql`
      INSERT INTO users (wallet_address, chain_id, role, status, wallet_first_tx_at, last_seen_at)
      VALUES (${parsed.data.wallet.toLowerCase()}, ${chainId}, ${parsed.data.role}, 'ACTIVE', now(), now())
      ON CONFLICT (wallet_address) DO UPDATE SET role = EXCLUDED.role
    `);
    // P0 #3: audit trail bootstrap di admin_audit (ip hanya sebagai hash).
    const ipHash = createHash('sha256').update(`booth-admin:${req.ip}`, 'utf8').digest('hex');
    await db.insert(schema.adminAudit).values({
      action: 'GRANT_ROLE',
      walletAddress: parsed.data.wallet.toLowerCase(),
      role: parsed.data.role,
      ipHash,
    });
    req.log.info({ op: 'grant-role', role: parsed.data.role });
    return { ok: true };
  });
};
