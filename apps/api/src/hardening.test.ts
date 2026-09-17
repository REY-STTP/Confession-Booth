// Tests T1H (Fase 1.5): FTS, slot midnight, PoW, abuse worker, storage IPFS, skor v2.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { trendingScoreV2, relatableScoreV2 } from '@booth/shared';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { abuseTick } from './workers/abuse.js';
import { issuePowChallenge, verifyPowSolution, solvePow } from './pow.js';
import {
  IpfsHttpAdapter,
  FallbackStorageAdapter,
  DbInlineAdapter,
  verifyStoredContent,
} from './storage.js';

const app = await buildApp();
const db = getDb();

before(async () => {
  await app.ready();
});

let ipN = 100;
const ip = () => `10.60.0.${(ipN++ % 200) + 1}`;
const rnd = (p: string) =>
  `${p} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function newUser() {
  const acc = privateKeyToAccount(generatePrivateKey());
  const myIp = ip();
  const nRes = await app.inject({
    method: 'GET',
    url: `/api/auth/nonce?address=${acc.address}`,
    remoteAddress: myIp,
  });
  assert.equal(nRes.statusCode, 200);
  const { nonce, message } = nRes.json();
  const sig = await acc.signMessage({ message });
  const vRes = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    remoteAddress: myIp,
    payload: { address: acc.address, signature: sig, nonce },
  });
  assert.equal(vRes.statusCode, 200);
  return { acc, token: vRes.json().accessToken as string };
}

/** Insert confession langsung via SQL (bypass rate-limit/PoW) untuk fixture FTS/slot. */
const createdIds: string[] = [];
async function insertConfession(opts: {
  authorWallet: string;
  category?: string;
  body: string;
  createdAt?: Date;
  status?: string;
}): Promise<{ id: string; publicId: string }> {
  const cat = (
    (await db.execute(
      sql`SELECT id FROM categories WHERE slug = ${opts.category ?? 'love'} LIMIT 1`,
    )) as unknown as {
      rows: Array<{ id: string }>;
    }
  ).rows[0].id;
  let user = (
    (await db.execute(
      sql`SELECT id FROM users WHERE wallet_address = ${opts.authorWallet.toLowerCase()} LIMIT 1`,
    )) as unknown as {
      rows: Array<{ id: string }>;
    }
  ).rows[0];
  if (!user) {
    user = (
      (await db.execute(
        sql`INSERT INTO users (wallet_address, chain_id) VALUES (${opts.authorWallet.toLowerCase()}, 11155111) RETURNING id`,
      )) as unknown as { rows: Array<{ id: string }> }
    ).rows[0];
  }
  const hash = createHash('sha256')
    .update(opts.body.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase(), 'utf8')
    .digest('hex');
  const co = (
    (await db.execute(
      sql`INSERT INTO content_objects (content_hash) VALUES (${hash}) ON CONFLICT (content_hash) DO UPDATE SET content_hash = EXCLUDED.content_hash RETURNING id`,
    )) as unknown as { rows: Array<{ id: string }> }
  ).rows[0];
  const publicId = `c_t1h${randomBytes(6).toString('base64url')}`;
  const conf = (
    (await db.execute(sql`
      INSERT INTO confessions (public_id, author_user_id, category_id, content_object_id, body_text, display_seed, status, published_at, created_at)
      VALUES (${publicId}, ${user.id}::uuid, ${cat}::uuid, ${co.id}::uuid, ${opts.body}, 1234, ${opts.status ?? 'VISIBLE'}, now(), ${(opts.createdAt ?? new Date()).toISOString()}::timestamptz)
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> }
  ).rows[0];
  createdIds.push(conf.id);
  return { id: conf.id, publicId };
}

describe('FTS Indonesia (T1H-004)', () => {
  it('kata khas ditemukan + ranking relevansi (3x > 1x)', async () => {
    const u = await newUser();
    const kw = `zqxwftp${Date.now().toString(36)}`;
    await insertConfession({
      authorWallet: u.acc.address,
      body: `${kw} mangga mangga mangga di pasar`,
    });
    await insertConfession({ authorWallet: u.acc.address, body: `${kw} mangga di kebun` });
    const res = await app.inject({
      method: 'GET',
      url: `/api/feed?q=${kw}%20mangga&limit=10`,
      remoteAddress: ip(),
    });
    assert.equal(res.statusCode, 200);
    const items = res.json().items as Array<{ content: string }>;
    assert.ok(items.length >= 2);
    assert.ok(items[0].content.includes('pasar'), '3x mangga harus rank pertama');
  });
});

describe('slot midnight (T1H-003)', () => {
  it('tag midnight ATAU jam 00–04 WIB masuk; siang non-midnight tidak', async () => {
    const u = await newUser();
    const tag = rnd('lagu tengah malam');
    // 02:30 WIB = 19:30 UTC hari sebelumnya (deterministik).
    const night = new Date();
    night.setUTCHours(19, 30, 0, 0);
    if (night.getTime() > Date.now()) night.setUTCDate(night.getUTCDate() - 1);
    const noon = new Date(night.getTime());
    noon.setUTCHours(5, 0, 0, 0); // 12:00 WIB
    const a = await insertConfession({
      authorWallet: u.acc.address,
      category: 'sad',
      body: `${tag} begadang`,
      createdAt: night,
    });
    const b = await insertConfession({
      authorWallet: u.acc.address,
      category: 'midnight',
      body: `${tag} tag`,
      createdAt: noon,
    });
    await insertConfession({
      authorWallet: u.acc.address,
      category: 'sad',
      body: `${tag} siang bolong`,
      createdAt: noon,
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/feed?slot=midnight&q=${encodeURIComponent(tag)}&limit=10`,
      remoteAddress: ip(),
    });
    assert.equal(res.statusCode, 200);
    const ids = (res.json().items as Array<{ id: string }>).map((i) => i.id);
    assert.ok(ids.includes(a.publicId), 'jam 02:30 WIB harus masuk slot midnight');
    assert.ok(ids.includes(b.publicId), 'tag midnight harus masuk slot midnight');
    assert.equal(ids.length, 2);
  });
});

describe('PoW eskalasi (T1H-005 + P0 #4 binding & single-use)', () => {
  it('issue → solve → verify ok; palsu/reuse/lintas-subjek ditolak', async () => {
    const subject = `pow-unit-${Date.now()}`;
    const ch = issuePowChallenge(subject);
    assert.ok(ch.difficulty >= 8 && ch.token.includes('.'));
    const salt = ch.token.split('.')[0];
    const nonceN = solvePow(salt, ch.difficulty);
    assert.ok(nonceN !== null);
    assert.equal(await verifyPowSolution(db, `${ch.token}:${nonceN}`, subject), true);
    // Single-use: solusi yang sama tidak bisa dipakai dua kali.
    assert.equal(await verifyPowSolution(db, `${ch.token}:${nonceN}`, subject), false);
    assert.equal(await verifyPowSolution(db, `${ch.token}:999999999`, subject), false);
    assert.equal(await verifyPowSolution(db, 'asal:0', subject), false);
    assert.equal(await verifyPowSolution(db, `${ch.token}:`, subject), false);
    // Lintas subjek: solusi subjek lain ditolak walau komputasi valid.
    const chB = issuePowChallenge(`${subject}-other`);
    const nB = solvePow(chB.token.split('.')[0], chB.difficulty);
    assert.ok(nB !== null);
    assert.equal(await verifyPowSolution(db, `${chB.token}:${nB}`, subject), false);
    assert.equal(await verifyPowSolution(db, `${chB.token}:${nB}`, `${subject}-other`), true);
  });

  it('akun bermasalah (4 report) → 429 POW_REQUIRED → solve → 201', async () => {
    const u = await newUser();
    const myIp = ip();
    const pub = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: myIp,
      headers: { authorization: `Bearer ${u.token}` },
      payload: { category: 'sad', content: rnd('pow target') },
    });
    assert.equal(pub.statusCode, 201);
    const target = pub.json().publicId as string;
    // 4 report non-kritis dari IP berbeda (hindari throttle dup per-target).
    for (const [i, reason] of ['SPAM', 'HARASSMENT', 'HATE', 'OTHER'].entries()) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/reports',
        remoteAddress: `10.61.${i}.${(ipN++ % 200) + 1}`,
        payload: { targetType: 'CONFESSION', targetId: target, reason },
      });
      assert.equal(r.statusCode, 201);
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${u.token}` },
      payload: { category: 'sad', content: rnd('pow coba') },
    });
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.json().error.code, 'POW_REQUIRED');
    const ch = blocked.json().error.challenge as { token: string; difficulty: number };
    const nonceN = solvePow(ch.token.split('.')[0], ch.difficulty);
    assert.ok(nonceN !== null);
    const retry = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${u.token}`, 'x-pow-solution': `${ch.token}:${nonceN}` },
      payload: { category: 'sad', content: rnd('pow lolos') },
    });
    assert.equal(retry.statusCode, 201);
  });
});

describe('abuse worker terjadwal (T1H-005)', () => {
  it('rescore + auto-quarantine 3x kritis (via SQL, tanpa triase route)', async () => {
    const u = await newUser();
    const c = await insertConfession({
      authorWallet: u.acc.address,
      body: rnd('abuse tick target'),
    });
    // 3 report kritis langsung via SQL agar triase route tidak ikut campur.
    for (const reason of ['THREAT', 'DOXXING', 'SPAM']) {
      await db.execute(sql`
        INSERT INTO reports (target_type, target_id, reason_code, status)
        VALUES ('CONFESSION', ${c.id}::uuid, ${reason}, 'OPEN')
      `);
    }
    const rep = await abuseTick(db);
    assert.ok(rep.rescored >= 1);
    // 2 kritis (50) + 1 biasa (5) = 55; quarantine butuh >=3 kritis → tetap VISIBLE.
    const row = (
      (await db.execute(
        sql`SELECT status, moderation_score AS s FROM confessions WHERE id = ${c.id}::uuid`,
      )) as unknown as {
        rows: Array<{ status: string; s: string }>;
      }
    ).rows[0];
    assert.equal(row.status, 'VISIBLE');
    assert.equal(Number(row.s), 55);
    await db.execute(sql`
      INSERT INTO reports (target_type, target_id, reason_code, status)
      VALUES ('CONFESSION', ${c.id}::uuid, 'THREAT', 'OPEN')
    `);
    const rep2 = await abuseTick(db);
    assert.equal(rep2.quarantined, 1);
    const row2 = (
      (await db.execute(
        sql`SELECT status FROM confessions WHERE id = ${c.id}::uuid`,
      )) as unknown as {
        rows: Array<{ status: string }>;
      }
    ).rows[0];
    assert.equal(row2.status, 'QUARANTINED');
  });
});

describe('storage IPFS (T1H-001)', () => {
  it('put Kubo (mock fetch) → cid; hash mismatch ditolak; cat ok', async () => {
    const realFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: unknown, init?: unknown) => {
        const u = String(url);
        if (u.includes('/api/v0/add')) {
          return new Response('{"Name":"f","Hash":"QmTest123"}\n', { status: 200 });
        }
        if (u.includes('/api/v0/cat')) {
          return new Response('isi asli', { status: 200 });
        }
        return new Response('x', { status: 500 });
      }) as typeof fetch;
      const adapter = new IpfsHttpAdapter('http://kubo:5001');
      const body = rnd('konten ipfs');
      const { hashContent } = await import('@booth/shared');
      const ref = await adapter.put(hashContent(body), body);
      assert.equal(ref.provider, 'ipfs:http');
      assert.equal(ref.cid, 'QmTest123');
      assert.equal(await adapter.cat('QmTest123'), 'isi asli');
      await assert.rejects(() => adapter.put('00'.repeat(32), body), /mismatch/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('fallback: primer gagal → sekunder inline; verify hash', async () => {
    const boom = {
      name: 'boom',
      put: async () => {
        throw new Error('down');
      },
    };
    const fb = new FallbackStorageAdapter(boom, new DbInlineAdapter());
    const ref = await fb.put('00'.repeat(32), 'apa saja');
    assert.equal(ref.provider, 'db:inline');
    // Route mem-passing canonicalHash (normalizeForDedup/lowercase) — samakan di sini.
    const { canonicalHash } = await import('./content.js');
    const body = 'Verifikasi Integritas Ipfs';
    assert.equal(verifyStoredContent(canonicalHash(body), body), true);
    assert.equal(verifyStoredContent(canonicalHash(body), `${body} diubah`), false);
  });
});

describe('skor ranking v2 (T1H-002)', () => {
  it('akun baru penuh → setengah base; 10 report → ×0.9^10', async () => {
    const { trendingScore } = await import('@booth/shared');
    const base = trendingScore({ reactions: 100, whispers: 10, uniqueEngagement: 50, ageHours: 5 });
    const sybil = trendingScoreV2({
      reactions: 100,
      whispers: 10,
      uniqueEngagement: 50,
      ageHours: 5,
      newAccountShare: 1,
    });
    assert.ok(Math.abs(sybil - base * 0.5) < 1e-9);
    const rep = trendingScoreV2({
      reactions: 100,
      whispers: 10,
      uniqueEngagement: 50,
      ageHours: 5,
      openReports: 10,
    });
    assert.ok(Math.abs(rep - base * Math.pow(0.9, 10)) < 1e-6);
    const rel = relatableScoreV2({ understand: 20, total: 25, ageHours: 2, openReports: 0 });
    assert.ok(rel > 0);
  });
});
