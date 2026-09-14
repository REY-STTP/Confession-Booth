// API tests dasar (DB): health, feed publik, validasi tulis, auth-gating.
// Alur konten penuh (reaksi/whisper/report/moderasi) di content.test.ts.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { assertPublicSafe } from '@booth/shared';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';

const app = await buildApp();
const db = getDb();

before(async () => {
  await app.ready();
});

let ipN = 0;
const ip = () => `10.20.0.${(ipN++ % 200) + 1}`;

async function newUser() {
  const acc = privateKeyToAccount(generatePrivateKey());
  const myIp = ip();
  const nRes = await app.inject({ method: 'GET', url: `/api/auth/nonce?address=${acc.address}`, remoteAddress: myIp });
  assert.equal(nRes.statusCode, 200);
  const { nonce, message } = nRes.json();
  const sig = await acc.signMessage({ message });
  const vRes = await app.inject({
    method: 'POST', url: '/api/auth/verify', remoteAddress: myIp,
    payload: { address: acc.address, signature: sig, nonce },
  });
  assert.equal(vRes.statusCode, 200);
  return { acc, token: vRes.json().accessToken as string };
}

const rnd = (p: string) => `${p} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function publish(token: string, category: string, content: string) {
  return app.inject({
    method: 'POST', url: '/api/confessions', remoteAddress: ip(),
    headers: { authorization: `Bearer ${token}` },
    payload: { category, content },
  });
}

function leaks(body: unknown): string[] {
  return assertPublicSafe(body);
}

describe('health', () => {
  it('GET /api/health ok tanpa secret', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(res.statusCode, 200);
    assert.ok(!/SESSION_SECRET|DATABASE_URL|RPC_URL/.test(res.body));
  });
  it('GET /api/health/chain tanpa secret', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/chain' });
    assert.equal(res.statusCode, 200);
    assert.ok(!/infura|alchemy|SECRET|KEY/i.test(res.body));
  });
});

describe('feed publik (DB)', () => {
  it('bisa dibaca tanpa auth + tanpa kebocoran identitas', async () => {
    const u = await newUser();
    const p = await publish(u.token, 'sad', rnd('feed dasar'));
    assert.equal(p.statusCode, 201);
    const res = await app.inject({ method: 'GET', url: '/api/feed?sort=new&limit=5' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.items) && body.items.length > 0);
    assert.deepEqual(leaks(body), []);
    for (const item of body.items) {
      assert.match(item.author.displayName, /^Anonymous #\d{4}$/);
    }
  });

  it('filter kategori + search + pagination tanpa duplikat', async () => {
    const u = await newUser();
    const marker = rnd('kucing');
    for (const [cat, c] of [['sad', marker], ['love', rnd('love')], ['sad', rnd('sedih')]] as const) {
      const r = await publish(u.token, cat, c);
      assert.equal(r.statusCode, 201);
    }
    const cat = await app.inject({ method: 'GET', url: '/api/feed?category=sad&limit=10' });
    assert.ok(cat.json().items.every((i: { category: string }) => i.category === 'sad'));
    const q = await app.inject({ method: 'GET', url: `/api/feed?q=${encodeURIComponent(marker)}&limit=5` });
    assert.ok(q.json().items.length >= 1);
    assert.ok(q.json().items.every((i: { content: string }) => i.content.includes(marker)));
    const p1 = await app.inject({ method: 'GET', url: '/api/feed?sort=new&limit=2' });
    const cursor = p1.json().nextCursor;
    assert.ok(typeof cursor === 'string');
    const p2 = await app.inject({ method: 'GET', url: `/api/feed?sort=new&limit=2&cursor=${encodeURIComponent(cursor)}` });
    const ids1 = new Set(p1.json().items.map((i: { id: string }) => i.id));
    for (const item of p2.json().items) assert.ok(!ids1.has(item.id));
  });

  it('sort trending/relatable jalan (fallback new bila skor kosong)', async () => {
    for (const sort of ['trending', 'relatable']) {
      const res = await app.inject({ method: 'GET', url: `/api/feed?sort=${sort}&limit=5` });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(leaks(res.json()), []);
    }
  });

  it('detail + 404 netral', async () => {
    const u = await newUser();
    const p = await publish(u.token, 'deep', rnd('detail nyata'));
    const id = p.json().publicId;
    const ok = await app.inject({ method: 'GET', url: `/api/confessions/${id}` });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(leaks(ok.json()), []);
    assert.equal(ok.json().content.includes('detail nyata'), true);
    const nf = await app.inject({ method: 'GET', url: '/api/confessions/c_tidakada' });
    assert.equal(nf.statusCode, 404);
  });
});

describe('tulis tervalidasi + auth-gating', () => {
  it('tanpa token → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/confessions', payload: { category: 'sad', content: 'x' } });
    assert.equal(res.statusCode, 401);
  });

  it('tolak XSS + 501 char + kategori invalid', async () => {
    const u = await newUser();
    const xss = await app.inject({
      method: 'POST', url: '/api/confessions', remoteAddress: ip(),
      headers: { authorization: `Bearer ${u.token}` },
      payload: { category: 'sad', content: '<script>alert(1)</script>' },
    });
    assert.equal(xss.statusCode, 400);
    const long = await app.inject({
      method: 'POST', url: '/api/confessions', remoteAddress: ip(),
      headers: { authorization: `Bearer ${u.token}` },
      payload: { category: 'sad', content: 'a'.repeat(501) },
    });
    assert.equal(long.statusCode, 400);
    const cat = await app.inject({
      method: 'POST', url: '/api/confessions', remoteAddress: ip(),
      headers: { authorization: `Bearer ${u.token}` },
      payload: { category: 'TOKEN', content: 'halo' },
    });
    assert.equal(cat.statusCode, 400);
  });

  it('DB sehat: kategori seed + tabel inti ada', async () => {
    const r = (await db.execute(sql`SELECT count(*)::int AS n FROM categories WHERE is_active = true`)) as unknown as {
      rows: Array<{ n: number }>;
    };
    assert.equal(r.rows[0].n, 11);
  });
});
