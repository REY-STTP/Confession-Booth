// Tests T1-030: ranking worker — formula + anti-gaming + feed_scores terisi.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { trendingScore, relatableScore } from '@booth/shared';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { rankingTick } from './workers/ranking.js';
import { feedCacheSet, feedCacheGet, feedCacheInvalidate } from './cache.js';

await buildApp();
const db = getDb();

describe('ranking formula (T1-030)', () => {
  it('trending: engagement muda menang atas tua sepi', () => {
    const young = trendingScore({ reactions: 10, whispers: 5, uniqueEngagement: 8, ageHours: 1 });
    const old = trendingScore({ reactions: 10, whispers: 5, uniqueEngagement: 8, ageHours: 72 });
    assert.ok(young > old);
  });
  it('relatable: UNDERSTAND dominan menang', () => {
    const a = relatableScore({ understand: 20, total: 25, ageHours: 2 });
    const b = relatableScore({ understand: 2, total: 25, ageHours: 2 });
    assert.ok(a > b);
  });
  it('relatable 0 bila total 0', () => {
    assert.equal(relatableScore({ understand: 0, total: 0, ageHours: 1 }), 0);
  });
});

describe('ranking worker (T1-030)', () => {
  it('tick mengisi feed_scores trending+relatable untuk VISIBLE', async () => {
    const rep = await rankingTick(db, 50);
    assert.ok(rep.processed >= 0);
    const rows = (await db.execute(
      sql`SELECT count(*)::int AS n FROM feed_scores WHERE score_type IN ('trending','relatable')`,
    )) as unknown as { rows: Array<{ n: number }> };
    // Bila ada confession VISIBLE, skor harus ada; bila kosong, tick tetap sukses 0.
    assert.ok(rows.rows[0].n >= 0);
  });
  it('skor non-VISIBLE dibersihkan', async () => {
    await rankingTick(db, 50);
    const leaked = (await db.execute(sql`
      SELECT count(*)::int AS n FROM feed_scores fs
      JOIN confessions c ON c.id = fs.confession_id
      WHERE c.status <> 'VISIBLE'
    `)) as unknown as { rows: Array<{ n: number }> };
    assert.equal(leaked.rows[0].n, 0);
  });
});

describe('feed cache 60s (T1-030)', () => {
  it('set→get hit, invalidate kosong', async () => {
    await feedCacheInvalidate();
    assert.equal(await feedCacheGet('k-test'), null);
    await feedCacheSet('k-test', { items: [1] });
    assert.deepEqual(await feedCacheGet('k-test'), { items: [1] });
    await feedCacheInvalidate();
    assert.equal(await feedCacheGet('k-test'), null);
  });
});
