import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import { getStorage } from '../storage.js';
import { canonicalHash, displayName, newDisplaySeed, newPublicId } from '../content.js';
// P1 #11: whisper schema dari SSOT shared.
import { whisperSchema } from '@booth/shared';
import { checkContent, WHISPER_MAX } from '../validate.js';
import { withIdempotency } from '../idempotency.js';
import {
  rowsOf,
  rateLimitOr429,
  requireAuth,
  encodeCursor,
  decodeCursor,
  isPublicIdFormat,
  checkAndAwardBadge,
} from './common.js';
import { findConfession } from './confessions.js';

const whisperBody = whisperSchema;

export const whisperRoutes: FastifyPluginAsync = async (app) => {
  // --- Whispers (T1-013 & T3-001 Confession Chains) ---
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
      badge_type: string | null;
      parent_whisper_public_id: string | null;
      is_op: boolean;
    }>(
      await db.execute(sql`
        SELECT w.public_id, w.body_text, w.display_seed, w.created_at, w.badge_type,
               pw.public_id AS parent_whisper_public_id,
               (w.author_user_id IS NOT NULL AND c.author_user_id IS NOT NULL AND w.author_user_id = c.author_user_id) AS is_op
        FROM whispers w
        JOIN confessions c ON c.id = w.confession_id
        LEFT JOIN whispers pw ON pw.id = w.parent_whisper_id
        WHERE ${sql.join(conds, sql` AND `)}
        ORDER BY w.created_at ASC, w.public_id ASC LIMIT ${parsed.data.limit + 1}
      `),
    );
    const page = rows.slice(0, parsed.data.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((w) => ({
        id: w.public_id,
        parentWhisperId: w.parent_whisper_public_id ?? null,
        author: { displayName: displayName(w.display_seed) },
        content: w.body_text,
        createdAt: new Date(w.created_at).toISOString(),
        isOp: Boolean(w.is_op),
        badgeType: w.badge_type ?? null,
      })),
      nextCursor:
        rows.length > parsed.data.limit && last
          ? encodeCursor(new Date(last.created_at).toISOString(), last.public_id)
          : null,
    };
  });

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

    let parentWhisperDbId: string | null = null;
    const parentPublicId = parsed.data.parentWhisperId;
    if (parentPublicId) {
      const parentRows = rowsOf<{ id: string }>(
        await db.execute(sql`
          SELECT id FROM whispers
          WHERE public_id = ${parentPublicId}
            AND confession_id = ${found.id}::uuid
            AND status = 'VISIBLE'
          LIMIT 1
        `),
      );
      if (parentRows.length === 0) {
        return reply.code(404).send({
          error: {
            code: 'PARENT_NOT_FOUND',
            message: 'Parent whisper not found in this confession.',
          },
        });
      }
      parentWhisperDbId = parentRows[0].id;
    }

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
          parentWhisperId: parentWhisperDbId,
          authorUserId: userId,
          contentObjectId: coId,
          bodyText: parsed.data.content,
          displaySeed: seed,
          status: 'VISIBLE',
          publishedAt: new Date(),
          badgeType: parsed.data.badgeType ?? null,
        });
      });

      await checkAndAwardBadge(db, userId, 'CHAIN_WEAVER');

      return {
        statusCode: 201,
        body: {
          id: wid,
          status: 'visible',
          parentWhisperId: parentPublicId ?? null,
          badgeType: parsed.data.badgeType ?? null,
        },
      };
    };
    const idemKey = req.headers['idempotency-key'];
    if (typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
      const r = await withIdempotency(db, userId, `${found.id}:${idemKey}`, create);
      return reply.code(r.statusCode).send(r.body);
    }
    const r = await create();
    return reply.code(r.statusCode).send(r.body);
  });
};
