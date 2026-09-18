import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import { buildMerkleTree, commitmentSchema } from '@booth/shared';
import { rowsOf, rateLimitOr429, requireAuth } from './common.js';

// P1 #7: batas komitmen per user (anti-bloat Merkle) + cache root 60 detik.
const ZK_REGISTER_CAP = 5;
const MERKLE_ROOT_CACHE_TTL_MS = 60_000;
let merkleCache: { at: number; root: string; leaves: string[] } | null = null;

async function loadLeaves(): Promise<string[]> {
  const now = Date.now();
  if (merkleCache && now - merkleCache.at < MERKLE_ROOT_CACHE_TTL_MS) return merkleCache.leaves;
  const db = getDb();
  const all = rowsOf<{ commitment: string }>(
    await db.execute(sql`SELECT commitment FROM identity_commitments ORDER BY leaf_index ASC`),
  );
  const leaves = all.map((r) => r.commitment);
  const { root } = buildMerkleTree(leaves);
  merkleCache = { at: now, root, leaves };
  return leaves;
}

export const zkRoutes: FastifyPluginAsync = async (app) => {
  // --- ZK Anonymous Credentials & Merkle Tree (T2-001, T2-003) ---
  app.post('/api/zk/register-commitment', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    // P1 #7: throttle registrasi per-IP (satu user tak bisa spam commitment).
    if (!(await rateLimitOr429(reply, `ip:${req.ip}`, 'zkRegister'))) return;
    // P1 #11: commitment schema dari SSOT shared.
    const parsed = commitmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_COMMITMENT', message: 'Invalid 32-byte hex commitment.' },
      });
    }

    const db = getDb();
    const userId = req.user!.id;
    const commitment = parsed.data.commitment.toLowerCase();
    const owned = rowsOf<{ n: string }>(
      await db.execute(
        sql`SELECT count(*) AS n FROM identity_commitments WHERE user_id = ${userId}::uuid`,
      ),
    );
    const already = rowsOf<{ one: number }>(
      await db.execute(sql`
        SELECT 1 AS one FROM identity_commitments
        WHERE user_id = ${userId}::uuid AND commitment = ${commitment} LIMIT 1
      `),
    );
    // P1 #7: cap per-user (registrasi ulang milik sendiri tetap idempoten).
    if (already.length === 0 && Number(owned[0]?.n ?? 0) >= ZK_REGISTER_CAP) {
      return reply.code(429).send({
        error: { code: 'COMMITMENT_LIMIT', message: 'Too many registered commitments.' },
      });
    }
    await db
      .insert(schema.identityCommitments)
      .values({ userId, commitment })
      .onConflictDoNothing();
    merkleCache = null;

    const leaves = await loadLeaves();
    const { root } = buildMerkleTree(leaves);
    const all = rowsOf<{ commitment: string; leaf_index: number }>(
      await db.execute(
        sql`SELECT commitment, leaf_index FROM identity_commitments ORDER BY leaf_index ASC`,
      ),
    );
    const myLeaf = all.find((r) => r.commitment === commitment);

    return {
      ok: true,
      root,
      leafIndex: myLeaf?.leaf_index ?? 0,
      totalMembers: leaves.length,
    };
  });

  app.get('/api/zk/merkle-root', async (req, reply) => {
    // P1 #7: paginasi agar anonymity set tak ter-enumerasi sekaligus + hemat respons.
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(5000).default(1000),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid query.' } });
    }
    const leaves = await loadLeaves();
    const { root } = buildMerkleTree(leaves);
    const { limit, offset } = parsed.data;
    const page = leaves.slice(offset, offset + limit);
    return {
      root,
      totalMembers: leaves.length,
      commitments: page,
      nextOffset: offset + limit < leaves.length ? offset + limit : null,
    };
  });
};
