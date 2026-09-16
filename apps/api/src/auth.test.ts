// Auth tests T1-002/T1-003: challenge nyata, signature viem asli, replay/expiry/domain,
// refresh rotation, logout, RBAC moderator, rate-limit nonce.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { sha256hex } from './auth.js';
import { config } from './config.js';

const app = await buildApp();
const db = getDb();

/** db.execute (node-postgres) mengembalikan { rows }, bukan array. */
function rowsOf<T>(res: unknown): T[] {
  return (res as { rows: T[] }).rows ?? [];
}

const A = privateKeyToAccount(generatePrivateKey());
const B = privateKeyToAccount(generatePrivateKey());

before(async () => {
  await app.ready();
  await db.execute(
    sql`TRUNCATE sessions, auth_nonces, users, rate_limit_buckets RESTART IDENTITY CASCADE`,
  );
});

async function loginAs(account = A, ip = '10.10.0.1') {
  const nRes = await app.inject({
    method: 'GET',
    url: `/api/auth/nonce?address=${account.address}`,
    remoteAddress: ip,
  });
  assert.equal(nRes.statusCode, 200);
  const { nonce, message, expiresAt } = nRes.json();
  assert.ok(nonce && message && expiresAt);
  assert.ok(!/0x[a-fA-F0-9]{64}/.test(JSON.stringify(nRes.json()))); // tanpa secret mentah
  const sig = await account.signMessage({ message });
  const vRes = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    remoteAddress: ip,
    payload: { address: account.address, signature: sig, nonce },
  });
  return { vRes, nonce, message };
}

describe('auth wallet (T1-002)', () => {
  it('happy path: nonce → sign → verify → sesi', async () => {
    const { vRes } = await loginAs(A, '10.10.0.11');
    assert.equal(vRes.statusCode, 200);
    const body = vRes.json();
    assert.equal(body.authenticated, true);
    assert.ok(typeof body.accessToken === 'string' && body.accessToken.length >= 32);
    // Respons TIDAK memuat wallet (identitas privat).
    assert.ok(!JSON.stringify(body).includes(A.address.slice(2, 10)));
    const setCookie = vRes.headers['set-cookie'];
    assert.ok(String(setCookie).includes('booth_refresh'));
    assert.ok(String(setCookie).includes('HttpOnly'));
  });

  it('replay nonce ditolak (NONCE_REUSED)', async () => {
    const ip = '10.10.0.12';
    const nRes = await app.inject({
      method: 'GET',
      url: `/api/auth/nonce?address=${A.address}`,
      remoteAddress: ip,
    });
    const { nonce, message } = nRes.json();
    const sig = await A.signMessage({ message });
    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: A.address, signature: sig, nonce },
    });
    assert.equal(first.statusCode, 200);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: A.address, signature: sig, nonce },
    });
    assert.equal(replay.statusCode, 401);
    assert.equal(replay.json().error.code, 'NONCE_REUSED');
  });

  it('signature orang lain ditolak (BAD_SIGNATURE)', async () => {
    const ip = '10.10.0.13';
    const nRes = await app.inject({
      method: 'GET',
      url: `/api/auth/nonce?address=${A.address}`,
      remoteAddress: ip,
    });
    const { nonce, message } = nRes.json();
    const evil = await B.signMessage({ message }); // B tanda tangan pesan milik A
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: A.address, signature: evil, nonce },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'BAD_SIGNATURE');
  });

  it('nonce kedaluwarsa ditolak (NONCE_EXPIRED)', async () => {
    const ip = '10.10.0.14';
    const nRes = await app.inject({
      method: 'GET',
      url: `/api/auth/nonce?address=${A.address}`,
      remoteAddress: ip,
    });
    const { nonce, message } = nRes.json();
    await db.execute(
      sql`UPDATE auth_nonces SET expires_at = now() - interval '1 minute' WHERE nonce_hash = ${sha256hex(nonce)}`,
    );
    const sig = await A.signMessage({ message });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: A.address, signature: sig, nonce },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'NONCE_EXPIRED');
  });

  it('domain salah ditolak (WRONG_DOMAIN)', async () => {
    const ip = '10.10.0.15';
    const nRes = await app.inject({
      method: 'GET',
      url: `/api/auth/nonce?address=${A.address}`,
      remoteAddress: ip,
    });
    const { nonce, message } = nRes.json();
    await db.execute(
      sql`UPDATE auth_nonces SET domain = 'evil.test' WHERE nonce_hash = ${sha256hex(nonce)}`,
    );
    const sig = await A.signMessage({ message });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: A.address, signature: sig, nonce },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'WRONG_DOMAIN');
  });

  it('address tanpa signature / mismatch ditolak', async () => {
    const ip = '10.10.0.16';
    const noSig = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: A.address, nonce: 'x' },
    });
    assert.equal(noSig.statusCode, 400);
    const nRes = await app.inject({
      method: 'GET',
      url: `/api/auth/nonce?address=${A.address}`,
      remoteAddress: ip,
    });
    const { nonce } = nRes.json();
    const mismatch = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      remoteAddress: ip,
      payload: { address: B.address, signature: `0x${'ab'.repeat(32)}65`, nonce },
    });
    assert.equal(mismatch.statusCode, 401);
    assert.equal(mismatch.json().error.code, 'ADDRESS_MISMATCH');
  });

  it('address disimpan lowercase + user upsert (login 2x = 1 user)', async () => {
    await loginAs(B, '10.10.0.17');
    await loginAs(B, '10.10.0.18');
    const found = rowsOf<{ wallet_address: string }>(
      await db.execute(
        sql`SELECT wallet_address FROM users WHERE wallet_address = ${B.address.toLowerCase()}`,
      ),
    );
    assert.equal(found.length, 1);
  });

  it('refresh rotation + logout revoke', async () => {
    const ip = '10.10.0.19';
    const { vRes } = await loginAs(A, ip);
    const cookie = String(vRes.headers['set-cookie']).split(';')[0];
    const origin = config.corsOrigin[0]?.trim() || 'http://localhost:3000';
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      remoteAddress: ip,
      headers: { cookie, origin },
    });
    assert.equal(r1.statusCode, 200);
    assert.ok(r1.json().accessToken);
    // refresh lama tidak bisa dipakai lagi
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      remoteAddress: ip,
      headers: { cookie, origin },
    });
    assert.equal(r2.statusCode, 401);
    // logout revoke access token
    const access = vRes.json().accessToken;
    const lo = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      remoteAddress: ip,
      headers: { authorization: `Bearer ${access}`, cookie, origin },
    });
    assert.equal(lo.statusCode, 200);
  });

  it('CSRF origin-check: refresh/logout tolak missing, null, dan origin asing', async () => {
    const ip = '10.10.0.19';
    const { vRes } = await loginAs(A, ip);
    const cookie = String(vRes.headers['set-cookie']).split(';')[0];
    const access = vRes.json().accessToken;

    // Tanpa origin -> 403
    const noOrigin = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      remoteAddress: ip,
      headers: { cookie },
    });
    assert.equal(noOrigin.statusCode, 403);
    assert.equal(noOrigin.json().error.code, 'FORBIDDEN');

    // Origin 'null' -> 403
    const nullOrigin = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      remoteAddress: ip,
      headers: { cookie, origin: 'null' },
    });
    assert.equal(nullOrigin.statusCode, 403);
    assert.equal(nullOrigin.json().error.code, 'FORBIDDEN');

    // Origin asing -> 403
    const badOrigin = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      remoteAddress: ip,
      headers: { cookie, origin: 'https://evil.com' },
    });
    assert.equal(badOrigin.statusCode, 403);
    assert.equal(badOrigin.json().error.code, 'FORBIDDEN');

    // Logout tanpa origin -> 403
    const loNoOrigin = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      remoteAddress: ip,
      headers: { authorization: `Bearer ${access}`, cookie },
    });
    assert.equal(loNoOrigin.statusCode, 403);
    assert.equal(loNoOrigin.json().error.code, 'FORBIDDEN');
  });

  it('rate-limit nonce 10/10 mnt + header Retry-After', async () => {
    const ip = '10.10.0.20';
    for (let i = 0; i < 10; i++) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/auth/nonce?address=${A.address}`,
        remoteAddress: ip,
      });
      assert.equal(r.statusCode, 200);
    }
    const over = await app.inject({
      method: 'GET',
      url: `/api/auth/nonce?address=${A.address}`,
      remoteAddress: ip,
    });
    assert.equal(over.statusCode, 429);
    assert.equal(over.json().error.code, 'RATE_LIMITED');
    assert.ok(over.headers['retry-after']);
  });
});

describe('session + RBAC (T1-003)', () => {
  it('anon 401, user biasa 403 di /moderation/queue', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/moderation/queue' });
    assert.equal(anon.statusCode, 401);
    const { vRes } = await loginAs(A, '10.10.0.21');
    const user = await app.inject({
      method: 'GET',
      url: '/api/moderation/queue',
      headers: { authorization: `Bearer ${vRes.json().accessToken}` },
    });
    assert.equal(user.statusCode, 403);
  });

  it('moderator 200; akun BANNED diblokir', async () => {
    const { vRes } = await loginAs(B, '10.10.0.22');
    const access = vRes.json().accessToken;
    await db.execute(
      sql`UPDATE users SET role = 'MODERATOR' WHERE wallet_address = ${B.address.toLowerCase()}`,
    );
    const mod = await app.inject({
      method: 'GET',
      url: '/api/moderation/queue',
      headers: { authorization: `Bearer ${access}` },
    });
    assert.equal(mod.statusCode, 200);
    await db.execute(
      sql`UPDATE users SET status = 'BANNED' WHERE wallet_address = ${B.address.toLowerCase()}`,
    );
    const banned = await app.inject({
      method: 'GET',
      url: '/api/moderation/queue',
      headers: { authorization: `Bearer ${access}` },
    });
    assert.equal(banned.statusCode, 403);
    await db.execute(
      sql`UPDATE users SET status = 'ACTIVE', role = 'USER' WHERE wallet_address = ${B.address.toLowerCase()}`,
    );
  });

  it('token palsu → anon (tidak bocor info)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/moderation/queue',
      headers: { authorization: 'Bearer ffff' },
    });
    assert.equal(res.statusCode, 401);
  });
});
