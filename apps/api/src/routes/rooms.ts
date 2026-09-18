import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { feedCacheGet, feedCacheSet } from '../cache.js';
import { rowsOf, rateLimitReadOr429 } from './common.js';

export const roomRoutes: FastifyPluginAsync = async (app) => {
  // --- T3-003: Community Rooms API ---
  // AUDIT PERF-004: Cache rooms listing (invalidated on confession changes/moderation)
  app.get('/api/rooms', async (req, reply) => {
    // P2 #15: throttle baca.
    if (!(await rateLimitReadOr429(reply, req))) return;
    const cached = await feedCacheGet('rooms:all');
    if (cached) return cached;

    const db = getDb();
    const rows = rowsOf<{
      slug: string;
      name: string;
      description: string;
      icon: string;
      rules: string | null;
      sort_order: number;
      confession_count: string;
    }>(
      await db.execute(sql`
        SELECT r.slug, r.name, r.description, r.icon, r.rules, r.sort_order,
               count(c.id) AS confession_count
        FROM rooms r
        LEFT JOIN confessions c ON c.room_id = r.id AND c.status = 'VISIBLE'
        WHERE r.is_active = true
        GROUP BY r.id
        ORDER BY r.sort_order ASC, r.name ASC
      `),
    );
    const result = {
      rooms: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        description: r.description,
        icon: r.icon,
        rules: r.rules,
        confessionCount: Number(r.confession_count ?? 0),
      })),
    };
    await feedCacheSet('rooms:all', result);
    return result;
  });

  app.get('/api/rooms/:slug', async (req, reply) => {
    if (!(await rateLimitReadOr429(reply, req))) return;
    const { slug } = req.params as { slug: string };
    const db = getDb();
    const rows = rowsOf<{
      slug: string;
      name: string;
      description: string;
      icon: string;
      rules: string | null;
      confession_count: string;
    }>(
      await db.execute(sql`
        SELECT r.slug, r.name, r.description, r.icon, r.rules,
               count(c.id) AS confession_count
        FROM rooms r
        LEFT JOIN confessions c ON c.room_id = r.id AND c.status = 'VISIBLE'
        WHERE r.slug = ${slug} AND r.is_active = true
        GROUP BY r.id
        LIMIT 1
      `),
    );
    if (rows.length === 0) {
      return reply
        .code(404)
        .send({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' } });
    }
    const r = rows[0];
    return {
      slug: r.slug,
      name: r.name,
      description: r.description,
      icon: r.icon,
      rules: r.rules,
      confessionCount: Number(r.confession_count ?? 0),
    };
  });
};
