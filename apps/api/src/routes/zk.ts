import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import { buildMerkleTree } from '@booth/shared';
import { rowsOf, requireAuth } from './common.js';

export const zkRoutes: FastifyPluginAsync = async (app) => {
  // --- ZK Anonymous Credentials & Merkle Tree (T2-001, T2-003) ---
  app.post('/api/zk/register-commitment', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const bodySchema = z.object({
      commitment: z.string().regex(/^[0-9a-fA-F]{64}$/),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_COMMITMENT', message: 'Invalid 32-byte hex commitment.' },
      });
    }

    const db = getDb();
    const commitment = parsed.data.commitment.toLowerCase();
    await db
      .insert(schema.identityCommitments)
      .values({ commitment })
      .onConflictDoNothing({ target: schema.identityCommitments.commitment });

    const all = rowsOf<{ commitment: string; leaf_index: number }>(
      await db.execute(
        sql`SELECT commitment, leaf_index FROM identity_commitments ORDER BY leaf_index ASC`,
      ),
    );
    const leaves = all.map((r) => r.commitment);
    const { root } = buildMerkleTree(leaves);
    const myLeaf = all.find((r) => r.commitment === commitment);

    return {
      ok: true,
      root,
      leafIndex: myLeaf?.leaf_index ?? 0,
      totalMembers: leaves.length,
    };
  });

  app.get('/api/zk/merkle-root', async (_req, _reply) => {
    const db = getDb();
    const all = rowsOf<{ commitment: string; leaf_index: number }>(
      await db.execute(
        sql`SELECT commitment, leaf_index FROM identity_commitments ORDER BY leaf_index ASC`,
      ),
    );
    const leaves = all.map((r) => r.commitment);
    const { root } = buildMerkleTree(leaves);
    return {
      root,
      totalMembers: leaves.length,
      commitments: leaves,
    };
  });
};
