// Alur 1B: publish → reaksi → whisper → report → moderasi + privacy scan.
// Setiap test memakai wallet baru (isolasi rate-limit/kuota antar test & antar run).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { assertPublicSafe } from '@booth/shared';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { canonicalHash } from './content.js';

const app = await buildApp();
const db = getDb();

before(async () => {
  await app.ready();
});

let ipN = 0;
const ip = () => `10.30.0.${(ipN++ % 200) + 1}`;
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

async function publish(token: string, category: string, content: string, key?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/confessions',
    remoteAddress: ip(),
    headers: { authorization: `Bearer ${token}`, ...(key ? { 'idempotency-key': key } : {}) },
    payload: { category, content },
  });
}

async function promote(addr: string, role: 'MODERATOR' | 'ADMIN' = 'MODERATOR') {
  await db.execute(
    sql`UPDATE users SET role = ${role} WHERE wallet_address = ${addr.toLowerCase()}`,
  );
}

describe('POST /confessions (T1-010)', () => {
  it('happy path: 201 tanpa wallet, proof PENDING_CHAIN, tampil di feed', async () => {
    const u = await newUser();
    const body = rnd('pengakuan bahagia');
    const res = await publish(u.token, 'love', body);
    assert.equal(res.statusCode, 201);
    const j = res.json();
    assert.ok(j.publicId.startsWith('c_'));
    assert.equal(j.status, 'visible');
    assert.match(j.author.displayName, /^Anonymous #\d{4}$/);
    assert.deepEqual(assertPublicSafe(j), []);

    const proof = await app.inject({ method: 'GET', url: `/api/confessions/${j.publicId}/proof` });
    assert.equal(proof.statusCode, 200);
    assert.equal(proof.json().contentHash, canonicalHash(body));
    assert.equal(proof.json().status, 'PENDING_CHAIN');

    const feed = await app.inject({ method: 'GET', url: `/api/feed?sort=new&limit=50` });
    assert.ok(feed.json().items.some((i: { id: string }) => i.id === j.publicId));
  });

  it('duplikat (termasuk beda kapital) → 409', async () => {
    const u = await newUser();
    const body = rnd('Duplikat Saya');
    assert.equal((await publish(u.token, 'sad', body)).statusCode, 201);
    const dup = await publish(u.token, 'sad', body.toLowerCase());
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().error.code, 'CONTENT_DUPLICATE');
  });

  it('rate-limit: confession valid ke-4 → 429 (400 tidak dihitung)', async () => {
    const u = await newUser();
    for (const bad of ['<b>x</b>', 'y'.repeat(501)]) {
      const r = await publish(u.token, 'sad', bad);
      assert.equal(r.statusCode, 400);
    }
    for (let i = 0; i < 3; i++)
      assert.equal((await publish(u.token, 'life', rnd(`kuota ${i}`))).statusCode, 201);
    const over = await publish(u.token, 'life', rnd('kelebihan'));
    assert.equal(over.statusCode, 429);
    assert.equal(over.json().error.code, 'RATE_LIMITED');
  });

  it('idempotency-key: retry → respons identik, 1 record', async () => {
    const u = await newUser();
    const key = `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const a = await publish(u.token, 'deep', rnd('idem conf'), key);
    assert.equal(a.statusCode, 201);
    const b = await publish(u.token, 'deep', rnd('konten beda diabaikan'), key);
    assert.equal(b.statusCode, 201);
    assert.deepEqual(a.json(), b.json());
  });
});

describe('reactions (T1-012)', () => {
  it('post + idempoten + unlike + counts di detail', async () => {
    const author = await newUser();
    const reactor = await newUser();
    const pid = (await publish(author.token, 'funny', rnd('lucu sekali'))).json().publicId;

    const anon = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/reactions`,
      payload: { type: 'LOVE' },
    });
    assert.equal(anon.statusCode, 401);

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/reactions`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${reactor.token}` },
      payload: { type: 'LOVE' },
    });
    assert.equal(r1.statusCode, 200);
    assert.equal(r1.json().reacted, true);

    const r2 = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/reactions`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${reactor.token}` },
      payload: { type: 'LOVE' },
    });
    assert.equal(r2.json().reacted, false); // duplikat aman, tanpa dobel

    const bad = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/reactions`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${reactor.token}` },
      payload: { type: 'LIKE' },
    });
    assert.equal(bad.statusCode, 400);

    const detail = await app.inject({ method: 'GET', url: `/api/confessions/${pid}` });
    assert.equal(detail.json().reactions.love, 1);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/confessions/${pid}/reactions/LOVE`,
      headers: { authorization: `Bearer ${reactor.token}` },
    });
    assert.equal(del.statusCode, 200);
    const after = await app.inject({ method: 'GET', url: `/api/confessions/${pid}` });
    assert.equal(after.json().reactions.love, 0);
  });
});

describe('whispers (T1-013)', () => {
  it('post + list + whisperCount + XSS 400 + dup 409', async () => {
    const author = await newUser();
    const w = await newUser();
    const pid = (await publish(author.token, 'sad', rnd('butuh teman'))).json().publicId;

    const xss = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${w.token}` },
      payload: { content: '<img src=x onerror=1>' },
    });
    assert.equal(xss.statusCode, 400);

    const text = rnd('kamu tidak sendirian');
    const p1 = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${w.token}` },
      payload: { content: text },
    });
    assert.equal(p1.statusCode, 201);

    const dup = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${w.token}` },
      payload: { content: text },
    });
    assert.equal(dup.statusCode, 409);

    const list = await app.inject({ method: 'GET', url: `/api/confessions/${pid}/whispers` });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(assertPublicSafe(list.json()), []);
    assert.ok(list.json().items.some((x: { content: string }) => x.content === text));

    const detail = await app.inject({ method: 'GET', url: `/api/confessions/${pid}` });
    assert.equal(detail.json().whisperCount, 1);
  });
});

describe('reports + moderation (T1-014/T1-015)', () => {
  it('report anonim OPEN; reason invalid 404/400; masuk antrean moderator', async () => {
    const author = await newUser();
    const mod = await newUser();
    await promote(mod.acc.address);
    const pid = (await publish(author.token, 'life', rnd('target lapor'))).json().publicId;

    const badReason = await app.inject({
      method: 'POST',
      url: '/api/reports',
      payload: { targetType: 'CONFESSION', targetId: pid, reason: 'RUDE' },
    });
    assert.equal(badReason.statusCode, 400);
    const badTarget = await app.inject({
      method: 'POST',
      url: '/api/reports',
      payload: { targetType: 'CONFESSION', targetId: 'c_tidakada', reason: 'SPAM' },
    });
    assert.equal(badTarget.statusCode, 404);

    const rep = await app.inject({
      method: 'POST',
      url: '/api/reports',
      remoteAddress: ip(),
      payload: { targetType: 'CONFESSION', targetId: pid, reason: 'SPAM', details: 'spam link' },
    });
    assert.equal(rep.statusCode, 201);
    assert.equal(rep.json().status, 'OPEN');

    // Masih VISIBLE (bukan kritis) + tetap di feed
    assert.equal(
      (await app.inject({ method: 'GET', url: `/api/confessions/${pid}` })).statusCode,
      200,
    );

    const q = await app.inject({
      method: 'GET',
      url: '/api/moderation/queue?status=OPEN',
      headers: { authorization: `Bearer ${mod.token}` },
    });
    assert.equal(q.statusCode, 200);
    assert.deepEqual(assertPublicSafe(q.json()), []);
    assert.ok(q.json().items.some((i: { targetPublicId: string }) => i.targetPublicId === pid));
  });

  it('konten kritis → QUARANTINED + hilang dari feed; hide → audit; restore → kembali', async () => {
    const author = await newUser();
    const mod = await newUser();
    await promote(mod.acc.address);
    const pid = (await publish(author.token, 'secret', rnd('target kritis'))).json().publicId;

    const rep = await app.inject({
      method: 'POST',
      url: '/api/reports',
      remoteAddress: ip(),
      payload: { targetType: 'CONFESSION', targetId: pid, reason: 'DOXXING' },
    });
    assert.equal(rep.statusCode, 201);
    assert.equal(
      (await app.inject({ method: 'GET', url: `/api/confessions/${pid}` })).statusCode,
      404,
    );

    const userHide = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${author.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'HIDE',
        reason_code: 'DOXXING',
        policy_version: 'v1.0',
      },
    });
    assert.equal(userHide.statusCode, 403);

    const hide = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'HIDE',
        reason_code: 'DOXXING',
        policy_version: 'v1.0',
      },
    });
    assert.equal(hide.statusCode, 200);

    const audit = (await db.execute(
      sql`SELECT action, policy_version FROM moderation_actions WHERE target_id = (SELECT id FROM confessions WHERE public_id = ${pid})`,
    )) as unknown as { rows: Array<{ action: string; policy_version: string }> };
    assert.ok(audit.rows.some((a) => a.action === 'HIDE' && a.policy_version === 'v1.0'));

    const restore = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'RESTORE',
        reason_code: 'OTHER',
        policy_version: 'v1.0',
      },
    });
    assert.equal(restore.statusCode, 200);
    assert.equal(
      (await app.inject({ method: 'GET', url: `/api/confessions/${pid}` })).statusCode,
      200,
    );
  });

  it('BAN author → tulis diblokir 403', async () => {
    const author = await newUser();
    const mod = await newUser();
    await promote(mod.acc.address);
    const pid = (await publish(author.token, 'work', rnd('target ban'))).json().publicId;
    const ban = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'BAN',
        reason_code: 'HARASSMENT',
        policy_version: 'v1.0',
      },
    });
    assert.equal(ban.statusCode, 200);
    const after = await publish(author.token, 'work', rnd('setelah ban'));
    assert.equal(after.statusCode, 403);
  });

  it('P1 #9: RESTORE konten VISIBLE → 409 INVALID_TRANSITION', async () => {
    const author = await newUser();
    const mod = await newUser();
    await promote(mod.acc.address);
    const pid = (await publish(author.token, 'love', rnd('restore invalid'))).json().publicId;
    const res = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'RESTORE',
        reason_code: 'OTHER',
        policy_version: 'v1.0',
      },
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error.code, 'INVALID_TRANSITION');
  });

  it('P1 #9: UNBAN memulihkan akun → publish 201 lagi', async () => {
    const author = await newUser();
    const mod = await newUser();
    await promote(mod.acc.address);
    const pid = (await publish(author.token, 'work', rnd('target unban'))).json().publicId;
    const ban = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'BAN',
        reason_code: 'HARASSMENT',
        policy_version: 'v1.0',
      },
    });
    assert.equal(ban.statusCode, 200);
    assert.equal((await publish(author.token, 'work', rnd('masih ban'))).statusCode, 403);
    const unban = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'UNBAN',
        reason_code: 'OTHER',
        policy_version: 'v1.0',
      },
    });
    assert.equal(unban.statusCode, 200);
    assert.equal((await publish(author.token, 'work', rnd('bebas lagi'))).statusCode, 201);
  });

  it('P1 #13: reactedByMe terisi bila authed, absen bila anon', async () => {
    const u = await newUser();
    const pid = (await publish(u.token, 'love', rnd('reacted by me'))).json().publicId;
    const react = await app.inject({
      method: 'POST',
      url: `/api/confessions/${pid}/reactions`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${u.token}` },
      payload: { type: 'LOVE' },
    });
    assert.equal(react.statusCode, 200);
    const authed = await app.inject({
      method: 'GET',
      url: `/api/confessions/${pid}`,
      headers: { authorization: `Bearer ${u.token}` },
    });
    assert.deepEqual(authed.json().reactedByMe, ['LOVE']);
    const anon = await app.inject({ method: 'GET', url: `/api/confessions/${pid}` });
    assert.equal('reactedByMe' in anon.json(), false);
    assert.deepEqual(assertPublicSafe(authed.json()), []);
  });

  it('P1 #9: resolve hanya reason yang ditindak, anon throttle per-IP', async () => {
    const author = await newUser();
    const mod = await newUser();
    await promote(mod.acc.address);
    const pid = (await publish(author.token, 'sad', rnd('resolve per reason'))).json().publicId;
    for (const reason of ['SPAM', 'THREAT']) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/reports',
        remoteAddress: ip(),
        payload: { targetType: 'CONFESSION', targetId: pid, reason },
      });
      assert.equal(r.statusCode, 201);
    }
    // Anon sama (IP sama) lapor reason sama → 429; IP beda reason sama → 201.
    const sameIp = '10.77.7.77';
    const first = await app.inject({
      method: 'POST',
      url: '/api/reports',
      remoteAddress: sameIp,
      payload: { targetType: 'CONFESSION', targetId: pid, reason: 'FRAUD' },
    });
    assert.equal(first.statusCode, 201);
    const dup = await app.inject({
      method: 'POST',
      url: '/api/reports',
      remoteAddress: sameIp,
      payload: { targetType: 'CONFESSION', targetId: pid, reason: 'FRAUD' },
    });
    assert.equal(dup.statusCode, 429);
    const otherIp = await app.inject({
      method: 'POST',
      url: '/api/reports',
      remoteAddress: '10.77.7.78',
      payload: { targetType: 'CONFESSION', targetId: pid, reason: 'FRAUD' },
    });
    assert.equal(otherIp.statusCode, 201);

    const hide = await app.inject({
      method: 'POST',
      url: '/api/moderation/actions',
      headers: { authorization: `Bearer ${mod.token}` },
      payload: {
        targetType: 'CONFESSION',
        targetId: pid,
        action: 'HIDE',
        reason_code: 'SPAM',
        policy_version: 'v1.0',
      },
    });
    assert.equal(hide.statusCode, 200);
    const states = (await db.execute(sql`
      SELECT reason_code, status FROM reports
      WHERE target_id = (SELECT id FROM confessions WHERE public_id = ${pid})
    `)) as unknown as { rows: Array<{ reason_code: string; status: string }> };
    const byReason = new Map(states.rows.map((r) => [r.reason_code, r.status]));
    assert.equal(byReason.get('SPAM'), 'RESOLVED');
    assert.equal(byReason.get('THREAT'), 'OPEN');
  });
});

describe('privacy scan publik (TESTING §7)', () => {
  it('semua respons publik bebas identitas', async () => {
    const u = await newUser();
    const pid = (await publish(u.token, 'deep', rnd('scan privasi'))).json().publicId;
    const urls = [
      '/api/feed?sort=new&limit=10',
      `/api/confessions/${pid}`,
      `/api/confessions/${pid}/whispers`,
      `/api/confessions/${pid}/proof`,
    ];
    for (const url of urls) {
      const res = await app.inject({ method: 'GET', url });
      assert.equal(res.statusCode, 200, url);
      const body = res.json();
      if (url.endsWith('/proof')) {
        // contractAddress adalah referensi verifikasi publik (bukan identitas) —
        // dikecualikan dari heuristic wallet-like, tapi tetap harus ada.
        assert.ok(
          typeof body.contractAddress === 'string' && body.contractAddress.startsWith('0x'),
          url,
        );
        delete body.contractAddress;
      }
      assert.deepEqual(assertPublicSafe(body), [], url);
    }
  });
});
