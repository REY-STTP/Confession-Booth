// Tests T1-005: idempotency DB + abuse scoring.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { withIdempotency } from './idempotency.js';
import { scoreAbuse } from './abuse.js';

await buildApp();
const db = getDb();

function randomWallet(): string {
  return `0x${randomBytes(20).toString('hex')}`;
}

async function ensureUser(wallet: string): Promise<string> {
  const lower = wallet.toLowerCase();
  const rows = (await db.execute(
    sql`INSERT INTO users (wallet_address, chain_id) VALUES (${lower}, 11155111)
        ON CONFLICT (wallet_address) DO UPDATE SET last_seen_at = now() RETURNING id`,
  )) as unknown as { rows: Array<{ id: string }> };
  return rows.rows[0].id;
}

let userId: string;
before(async () => {
  userId = await ensureUser('0x0000000000000000000000000000000000000001');
  await db.execute(sql`DELETE FROM idempotency_keys WHERE user_id = ${userId}::uuid`);
});

describe('idempotency DB (T1-005)', () => {
  it('retry key sama → 1 efek, respons identik, tandai replay', async () => {
    let effects = 0;
    const key = `idem-${Date.now()}`;
    const first = await withIdempotency(db, userId, key, async () => {
      effects += 1;
      return { statusCode: 201, body: { id: 'c_1' } };
    });
    assert.equal(first.replay, false);
    assert.equal(effects, 1);
    const second = await withIdempotency(db, userId, key, async () => {
      effects += 1;
      return { statusCode: 201, body: { id: 'c_2' } };
    });
    assert.equal(second.replay, true);
    assert.equal(effects, 1);
    assert.deepEqual(second.body, { id: 'c_1' });
    assert.equal(second.statusCode, 201);
  });

  it('key sama beda user → efek terpisah', async () => {
    const other = await ensureUser(randomWallet());
    try {
      const key = `idem-shared-${Date.now()}-${randomBytes(4).toString('hex')}`;
      const a = await withIdempotency(db, userId, key, async () => ({ statusCode: 201 as const, body: { by: 'a' } }));
      const b = await withIdempotency(db, other, key, async () => ({ statusCode: 201 as const, body: { by: 'b' } }));
      assert.equal(a.replay, false);
      assert.equal(b.replay, false);
      assert.deepEqual(b.body, { by: 'b' });
    } finally {
      await db.execute(sql`DELETE FROM users WHERE id = ${other}::uuid`);
    }
  });
});

describe('abuse scoring (T1-005)', () => {
  it('aktivitas normal → skor rendah, tanpa flag', () => {
    const v = scoreAbuse({ recentCount: 1, isDuplicate: false, openReports: 0 });
    assert.ok(v.score < 50 && v.flag === false && v.challenge === 'none');
  });
  it('duplikat langsung flag + captcha stub', () => {
    const v = scoreAbuse({ recentCount: 2, isDuplicate: true, openReports: 0 });
    assert.equal(v.flag, true);
    assert.equal(v.challenge, 'captcha');
  });
  it('velocity tinggi atau banyak report → flag', () => {
    assert.equal(scoreAbuse({ recentCount: 5, isDuplicate: false, openReports: 0 }).flag, true);
    assert.equal(scoreAbuse({ recentCount: 0, isDuplicate: false, openReports: 4 }).flag, true);
  });
  it('skor dibatasi 100', () => {
    assert.equal(scoreAbuse({ recentCount: 99, isDuplicate: true, openReports: 99 }).score, 100);
  });
});
