import type { FastifyPluginAsync } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import { feedCacheGet, feedCacheSet, feedCacheInvalidate } from '../cache.js';
import { getStorage } from '../storage.js';
import { scoreAbuse } from '../abuse.js';
import {
  canonicalHash,
  displayName,
  newDisplaySeed,
  newPublicId,
  onchainId,
  projectConfession,
  type ConfessionRow,
} from '../content.js';
import { checkContent, isCategory, isReaction, CONFESSION_MAX } from '../validate.js';
import { AuthError } from '../auth.js';
// P1 #11: payload schemas dari SSOT shared (bukan Zod lokal per-route).
import {
  buildMerkleTree,
  confessSchema,
  reactSchema,
  verifyAnonymousSignalProof,
} from '@booth/shared';
import { withIdempotency } from '../idempotency.js';
import {
  type Db,
  rowsOf,
  rateLimitOr429,
  requireAuth,
  encodeCursor,
  decodeCursor,
  escapeLike,
  isPublicIdFormat,
  checkAndAwardBadge,
  reactionMap,
  whisperCountMap,
  feedQuery,
} from './common.js';

/** P1 #13: peta confessionId → tipe reaksi milik pembaca (kosong bila anon). */
async function reactedByMeMap(
  db: Db,
  userId: string | undefined,
  ids: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!userId || ids.length === 0) return map;
  const rows = rowsOf<{ confession_id: string; reaction_type: string }>(
    await db.execute(sql`
      SELECT confession_id, reaction_type FROM reactions
      WHERE confession_id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) AND user_id = ${userId}::uuid
    `),
  );
  for (const r of rows) {
    const e = map.get(r.confession_id) ?? [];
    e.push(r.reaction_type);
    map.set(r.confession_id, e);
  }
  return map;
}

export async function findConfession(
  db: Db,
  publicId: string,
): Promise<(ConfessionRow & { id: string }) | null> {
  const rows = rowsOf<ConfessionRow & { id: string }>(
    await db.execute(sql`
      SELECT c.id, c.public_id, c.body_text, c.display_seed, c.status, c.created_at, cat.slug AS category,
             c.proof_type, r.slug AS room_slug, c.badge_type
      FROM confessions c
      JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN rooms r ON r.id = c.room_id
      WHERE c.public_id = ${publicId} LIMIT 1
    `),
  );
  return rows[0] ?? null;
}

// P1 #11: confessBody/reactBody pindah ke @booth/shared (confessSchema/reactSchema).

/** P0 #1: stub proof mock hanya diizinkan bila eksplisit (ZK_MOCK=true) atau non-prod.
 *  Prod tanpa ZK_MOCK=true → tolak sampai verifier Groth16 nyata tersedia. */
function isZkMockAllowed(): boolean {
  const v = process.env.ZK_MOCK;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

const confessBody = confessSchema;
const reactBody = reactSchema;

export const confessionRoutes: FastifyPluginAsync = async (app) => {
  // --- Feed (T1-011): hanya VISIBLE, proyeksi publik SCHEMA §17. ---
  app.get('/api/feed', async (req, reply) => {
    const parsed = feedQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid query.' } });
    }
    const { sort, category, room, limit, cursor, q, slot } = parsed.data;
    const db = getDb();
    const conds: ReturnType<typeof sql>[] = [sql`c.status = 'VISIBLE'`];
    if (category) conds.push(sql`cat.slug = ${category}`);
    if (room) conds.push(sql`r.slug = ${room}`);
    if (slot === 'midnight') {
      conds.push(
        sql`(cat.slug = 'midnight' OR EXTRACT(HOUR FROM c.created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN 0 AND 4)`,
      );
    }
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

    const cacheKey = `feed:${sort}:${category ?? ''}:${room ?? ''}:${limit}:${cursor ?? ''}:${q ?? ''}:${slot}`;
    const cached = await feedCacheGet(cacheKey);
    if (cached) return cached as object;

    const rows = rowsOf<ConfessionRow & { id: string }>(
      await db.execute(sql`
        SELECT c.id, c.public_id, c.body_text, c.display_seed, c.status, c.created_at, cat.slug AS category,
               c.proof_type, r.slug AS room_slug, c.badge_type,
               ${ftsRank} AS rank
        FROM confessions c
        JOIN categories cat ON cat.id = c.category_id
        LEFT JOIN rooms r ON r.id = c.room_id
        LEFT JOIN feed_scores fs ON fs.confession_id = c.id AND fs.score_type = ${sort}
        WHERE ${where}
        ORDER BY rank DESC, fs.score DESC NULLS LAST, c.created_at DESC, c.public_id DESC
        LIMIT ${limit + 1}
      `),
    );
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);
    const [rmap, wmap] = await Promise.all([reactionMap(db, ids), whisperCountMap(db, ids)]);
    const mine = await reactedByMeMap(db, req.user?.id, ids);
    const items = page.map((r) =>
      projectConfession(r, rmap.get(r.id) ?? {}, wmap.get(r.id) ?? 0, mine.get(r.id)),
    );
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

  app.get('/api/confessions/:publicId', async (req, reply) => {
    const { publicId } = req.params as { publicId: string };
    if (!isPublicIdFormat(publicId, 'c')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const db = getDb();
    const found = await findConfession(db, publicId);
    if (!found || found.status !== 'VISIBLE') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    const [rmap, wmap] = await Promise.all([
      reactionMap(db, [found.id]),
      whisperCountMap(db, [found.id]),
    ]);
    const mine = await reactedByMeMap(db, req.user?.id, [found.id]);
    return projectConfession(
      found,
      rmap.get(found.id) ?? {},
      wmap.get(found.id) ?? 0,
      mine.get(found.id),
    );
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
    const expectedContract =
      row.contract_address && !row.contract_address.startsWith('0x0000')
        ? row.contract_address
        : config.contractAddress && !config.contractAddress.startsWith('0x0000')
          ? config.contractAddress
          : '0xa8302048773DD213B9D311c2abda199B14339188';
    // P0 #5: verifier off-chain assert — klaim CONFIRMED hanya valid bila kontrak
    // dan chainId sesuai konfigurasi yang diharapkan (anti replay lintas-chain/fork).
    const verified =
      (row.status ?? 'PENDING_CHAIN') === 'CONFIRMED' &&
      row.contract_address?.toLowerCase() === expectedContract.toLowerCase() &&
      Number(row.chain_id) === config.chainId;
    return {
      publicId,
      contentHash: row.content_hash,
      txHash: row.transaction_hash,
      blockNumber: row.block_number,
      status: row.status ?? 'PENDING_CHAIN',
      contractAddress: expectedContract,
      chainId: String(row.chain_id ?? config.chainId),
      verified,
    };
  });

  // --- POST /confessions ---
  app.post('/api/confessions', async (req, reply) => {
    const db = getDb();
    const parsed = confessBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_CONTENT', message: 'Invalid payload.' } });
    }
    const { category, content, roomSlug, badgeType } = parsed.data;
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

    let roomId: string | null = null;
    if (roomSlug) {
      const roomRows = rowsOf<{ id: string }>(
        await db.execute(
          sql`SELECT id FROM rooms WHERE slug = ${roomSlug} AND is_active = true LIMIT 1`,
        ),
      );
      if (roomRows.length === 0) {
        return reply
          .code(404)
          .send({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' } });
      }
      roomId = roomRows[0].id;
    }

    const contentHash = canonicalHash(content);
    let userId: string | null = null;
    let nullifierHash: string | null = null;
    let proofType = 'SESSION';

    if (parsed.data.zkProof) {
      const zk = parsed.data.zkProof;
      // P0 #1: jalur ZK di-throttle per-IP sama seperti sesi (sebelum verifikasi mahal).
      if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'confess'))) return;
      if (!isZkMockAllowed()) {
        return reply.code(503).send({
          error: {
            code: 'ZK_VERIFIER_UNAVAILABLE',
            message: 'Anonymous proofs unavailable.',
          },
        });
      }
      if (zk.signal !== contentHash) {
        return reply.code(400).send({
          error: {
            code: 'SIGNAL_MISMATCH',
            message: 'ZK proof signal does not match content hash.',
          },
        });
      }

      const all = rowsOf<{ commitment: string }>(
        await db.execute(sql`SELECT commitment FROM identity_commitments ORDER BY leaf_index ASC`),
      );
      const leaves = all.map((r) => r.commitment);
      const { root: currentRoot } = buildMerkleTree(leaves);

      const vProof = verifyAnonymousSignalProof({
        proof: zk,
        knownRoots: [currentRoot],
        expectedSignal: contentHash,
      });
      if (!vProof.ok) {
        return reply.code(400).send({
          error: {
            code: vProof.reason ?? 'INVALID_PROOF',
            message: 'Anonymous ZK proof invalid.',
          },
        });
      }

      const existingNullifier = rowsOf<{ id: string }>(
        await db.execute(sql`
          SELECT id FROM epoch_nullifiers
          WHERE nullifier_hash = ${zk.nullifierHash}
            AND epoch = ${zk.epoch}
            AND scope = 'confess'
          LIMIT 1
        `),
      );
      if (existingNullifier.length > 0) {
        return reply.code(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Anonymous rate limit reached for this epoch.',
          },
        });
      }

      nullifierHash = zk.nullifierHash;
      proofType = 'ZK';
    } else {
      if (!requireAuth(req, reply)) return;
      userId = req.user!.id;
      if (!(await rateLimitOr429(reply, `user:${userId}`, 'confess'))) return;

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
    }

    const recent = userId
      ? rowsOf<{ n: string }>(
          await db.execute(sql`
            SELECT count(*) AS n FROM confessions
            WHERE author_user_id = ${userId}::uuid AND created_at > now() - interval '1 hour'
          `),
        )
      : [];
    const openRep = userId
      ? rowsOf<{ n: string }>(
          await db.execute(sql`
            SELECT count(*) AS n FROM reports r
            JOIN confessions c ON c.id = r.target_id AND r.target_type = 'CONFESSION'
            WHERE c.author_user_id = ${userId}::uuid
              AND r.status IN ('OPEN', 'REVIEWING')
              AND r.created_at > now() - interval '24 hours'
          `),
        )
      : [];
    const verdict = scoreAbuse({
      recentCount: Number(recent[0]?.n ?? 0),
      isDuplicate: false,
      openReports: Number(openRep[0]?.n ?? 0),
    });

    if (verdict.flag) {
      const { verifyPowSolution, issuePowChallenge } = await import('../pow.js');
      const sol = req.headers['x-pow-solution'];
      // P0 #4: solusi PoW diikat ke subjek (user untuk sesi, IP untuk ZK anonim).
      const powSubject = userId ? `user:${userId}` : `ip:${req.ip}`;
      if (typeof sol !== 'string' || !(await verifyPowSolution(db, sol, powSubject))) {
        return reply.code(429).send({
          error: {
            code: 'POW_REQUIRED',
            message: 'Solve proof-of-work and retry.',
            challenge: issuePowChallenge(powSubject),
          },
        });
      }
    }

    const create = async (): Promise<{ statusCode: number; body: unknown }> => {
      const publicId = newPublicId('c');
      const seed = newDisplaySeed();
      const now = new Date();
      const ref = await getStorage().put(contentHash, content);
      try {
        await db.transaction(async (tx) => {
          if (nullifierHash && parsed.data.zkProof) {
            // P0 #1: klaim nullifier atomik — konflik = replay/race → 429, bukan 500.
            // (SELECT pra-cek di atas hanya fast path dengan pesan jelas.)
            const claimed = await tx
              .insert(schema.epochNullifiers)
              .values({
                nullifierHash,
                epoch: parsed.data.zkProof.epoch,
                scope: 'confess',
              })
              .onConflictDoNothing()
              .returning({ id: schema.epochNullifiers.id });
            if (claimed.length === 0) {
              throw new AuthError(
                'RATE_LIMIT_EXCEEDED',
                'Anonymous rate limit reached for this epoch.',
                429,
              );
            }
          }

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
              roomId,
              contentObjectId: coId,
              bodyText: content,
              displaySeed: seed,
              status: 'VISIBLE',
              publishedAt: now,
              moderationScore: String(verdict.score),
              nullifierHash,
              proofType,
              badgeType: badgeType ?? null,
            })
            .returning({ id: schema.confessions.id });
          await tx.insert(schema.publications).values({
            confessionId: conf[0].id,
            chainId: config.chainId,
            contractAddress:
              config.contractAddress && !config.contractAddress.startsWith('0x0000')
                ? config.contractAddress
                : '0xa8302048773DD213B9D311c2abda199B14339188',
            onchainConfessionId: onchainId(publicId),
            contentHash,
            status: 'PENDING_CHAIN',
          });
        });
      } catch (e) {
        // P0 #1: race nullifier yang kalah → 429 konsisten (bukan 500).
        if (e instanceof AuthError && e.code === 'RATE_LIMIT_EXCEEDED') {
          return {
            statusCode: 429,
            body: {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Anonymous rate limit reached for this epoch.',
              },
            },
          };
        }
        throw e;
      }

      if (userId) {
        await checkAndAwardBadge(db, userId, 'MIDNIGHT_SOUL');
        if (proofType === 'ZK') await checkAndAwardBadge(db, userId, 'STEALTH_CONFESSOR');
      }
      await feedCacheInvalidate().catch((err) => app.log.error(err, 'feedCacheInvalidate failed'));

      return {
        statusCode: 201,
        body: {
          id: publicId,
          status: 'visible',
          publicId,
          author: { displayName: displayName(seed) },
          proofType,
          roomSlug,
          badgeType,
        },
      };
    };

    const idemKey = req.headers['idempotency-key'];
    if (userId && typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
      const r = await withIdempotency(db, userId, idemKey, create);
      return reply.code(r.statusCode).send(r.body);
    }
    const r = await create();
    return reply.code(r.statusCode).send(r.body);
  });

  // --- Reactions ---
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
      if (ins.length > 0) {
        await checkAndAwardBadge(db, req.user!.id, 'EMPATHETIC_LISTENER');
      }
      return { statusCode: 200, body: { ok: true, reacted: ins.length > 0 } };
    };
    const idemKey = req.headers['idempotency-key'];
    if (typeof idemKey === 'string' && idemKey.length > 0 && idemKey.length <= 128) {
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
};
