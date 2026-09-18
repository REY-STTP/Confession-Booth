// Test Fase 2: ZK Anonymous Credentials & Privacy-Preserving Rate Limiting (T2-001, T2-003)
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { canonicalHash } from './content.js';
import {
  deriveAnonymousIdentity,
  getMerkleProof,
  createAnonymousSignalProof,
  getCurrentEpoch,
} from '@booth/shared';

const app = await buildApp();
const db = getDb();

// P0 #1: stub proof mock hanya untuk test eksplisit (prod tanpa ZK_MOCK=true → 503).
process.env.ZK_MOCK = 'true';

before(async () => {
  await app.ready();
});

let ipN = 0;
const ip = () => `10.50.0.${(ipN++ % 200) + 1}`;

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

describe('Fase 2: ZK Anonymous Credentials & Nullifiers API (T2-001, T2-003)', () => {
  it('POST /api/zk/register-commitment menolak tanpa auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/zk/register-commitment',
      remoteAddress: ip(),
      payload: { commitment: '0'.repeat(64) },
    });
    assert.equal(res.statusCode, 401);
  });

  it('POST /api/zk/register-commitment menolak payload tidak valid', async () => {
    const user = await newUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/zk/register-commitment',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
      payload: { commitment: 'invalid-hex' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('POST /api/zk/register-commitment berhasil mendaftarkan komitmen identitas', async () => {
    const user = await newUser();
    const identity = deriveAnonymousIdentity('0xmySecretWalletSignature123');
    const res = await app.inject({
      method: 'POST',
      url: '/api/zk/register-commitment',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
      payload: { commitment: identity.commitment },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.match(body.root, /^[0-9a-f]{64}$/);
    assert.ok(body.totalMembers >= 1);
  });

  it('P1 #7: cap 5 komitmen per user + paginasi merkle-root', async () => {
    const user = await newUser();
    const stamp = Date.now();
    for (let i = 0; i < 5; i++) {
      const identity = deriveAnonymousIdentity(`0xcapTest_${stamp}_${i}`);
      const res = await app.inject({
        method: 'POST',
        url: '/api/zk/register-commitment',
        remoteAddress: ip(),
        headers: { authorization: `Bearer ${user.token}` },
        payload: { commitment: identity.commitment },
      });
      assert.equal(res.statusCode, 200);
    }
    // Registrasi ulang milik sendiri tetap idempoten (200, bukan 429).
    const retrySame = await app.inject({
      method: 'POST',
      url: '/api/zk/register-commitment',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
      payload: { commitment: deriveAnonymousIdentity(`0xcapTest_${stamp}_0`).commitment },
    });
    assert.equal(retrySame.statusCode, 200);
    // Komitmen ke-6 yang baru → 429 COMMITMENT_LIMIT.
    const sixth = await app.inject({
      method: 'POST',
      url: '/api/zk/register-commitment',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
      payload: { commitment: deriveAnonymousIdentity(`0xcapTest_${stamp}_5`).commitment },
    });
    assert.equal(sixth.statusCode, 429);
    assert.equal(sixth.json().error.code, 'COMMITMENT_LIMIT');

    const page = await app.inject({
      method: 'GET',
      url: '/api/zk/merkle-root?limit=1&offset=0',
      remoteAddress: ip(),
    });
    assert.equal(page.statusCode, 200);
    const body = page.json();
    assert.equal(body.commitments.length, 1);
    assert.ok(body.totalMembers >= 1);
    assert.ok(body.nextOffset === null || typeof body.nextOffset === 'number');

    const bad = await app.inject({
      method: 'GET',
      url: '/api/zk/merkle-root?limit=xyz',
      remoteAddress: ip(),
    });
    assert.equal(bad.statusCode, 400);
  });

  it('GET /api/zk/merkle-root mengembalikan Merkle root terkini', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/zk/merkle-root',
      remoteAddress: ip(),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.root, /^[0-9a-f]{64}$/);
    assert.ok(Array.isArray(body.commitments));
    assert.ok(body.totalMembers >= 1);
  });

  it('POST /api/confessions menolak zkProof dengan signal mismatch', async () => {
    const rootRes = await app.inject({
      method: 'GET',
      url: '/api/zk/merkle-root',
      remoteAddress: ip(),
    });
    const { root } = rootRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      payload: {
        category: 'deep',
        content: 'Confession test signal mismatch',
        zkProof: {
          merkleRoot: root,
          nullifierHash: 'a'.repeat(64),
          epoch: getCurrentEpoch(),
          scope: 'confess',
          // P0 #1: hex valid tapi salah nilai → tetap SIGNAL_MISMATCH (bukan INVALID_CONTENT).
          signal: 'ab'.repeat(32),
          proof: 'cd'.repeat(32),
        },
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'SIGNAL_MISMATCH');
  });

  it('P0 #1: ZK_MOCK=false → 503; payload non-hex → 400 INVALID_CONTENT', async () => {
    const prev = process.env.ZK_MOCK;
    try {
      process.env.ZK_MOCK = 'false';
      const gated = await app.inject({
        method: 'POST',
        url: '/api/confessions',
        remoteAddress: ip(),
        payload: {
          category: 'deep',
          content: 'Confession gate mock',
          zkProof: {
            merkleRoot: 'a'.repeat(64),
            nullifierHash: 'b'.repeat(64),
            epoch: getCurrentEpoch(),
            scope: 'confess',
            signal: 'c'.repeat(64),
            proof: 'd'.repeat(64),
          },
        },
      });
      assert.equal(gated.statusCode, 503);
      assert.equal(gated.json().error.code, 'ZK_VERIFIER_UNAVAILABLE');
    } finally {
      process.env.ZK_MOCK = prev ?? 'true';
    }

    const bad = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      payload: {
        category: 'deep',
        content: 'Confession hex invalid',
        zkProof: {
          merkleRoot: 'zz-top',
          nullifierHash: 'b'.repeat(64),
          epoch: getCurrentEpoch(),
          scope: 'confess',
          signal: 'c'.repeat(64),
          proof: 'd'.repeat(64),
        },
      },
    });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.json().error.code, 'INVALID_CONTENT');
  });

  it('POST /api/confessions berhasil mengirim ZK anonymous confession tanpa authorUserId (T2-001, T2-003)', async () => {
    const user = await newUser();
    const identity = deriveAnonymousIdentity(`0xuserZkPostingIdentitySignature_${Date.now()}`);

    // Daftarkan commitment identitas ini terlebih dahulu
    await app.inject({
      method: 'POST',
      url: '/api/zk/register-commitment',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
      payload: { commitment: identity.commitment },
    });

    const rootRes = await app.inject({
      method: 'GET',
      url: '/api/zk/merkle-root',
      remoteAddress: ip(),
    });
    const { commitments } = rootRes.json();
    const leafIndex = commitments.indexOf(identity.commitment);
    assert.ok(leafIndex >= 0);

    const merkleProof = getMerkleProof(commitments, leafIndex);
    const content = 'Ini adalah confession anonim murni menggunakan ZK Proof dan Epoch Nullifier.';
    const contentHash = canonicalHash(content);
    const epoch = getCurrentEpoch();

    const zkProof = createAnonymousSignalProof({
      identity,
      merkleProof,
      signal: contentHash,
      epoch,
      scope: 'confess',
    });

    // Kirim confession TANPA header Authorization (True Anonymous / Unlinkable!)
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      payload: {
        category: 'deep',
        content,
        zkProof,
      },
    });

    assert.equal(postRes.statusCode, 201);
    const body = postRes.json();
    assert.equal(body.status, 'visible');
    assert.equal(body.proofType, 'ZK');
    assert.match(body.publicId, /^c_/);

    // Verifikasi di Database: author_user_id WAJIB NULL dan nullifier_hash terisi!
    const rows = (await db.execute(sql`
        SELECT author_user_id, nullifier_hash, proof_type
        FROM confessions WHERE public_id = ${body.publicId} LIMIT 1
      `)) as any;
    const dbRow = rows.rows[0];
    assert.equal(dbRow.author_user_id, null);
    assert.equal(dbRow.nullifier_hash, zkProof.nullifierHash);
    assert.equal(dbRow.proof_type, 'ZK');

    // Uji Rate Limiting: Mengirim confession kedua dengan nullifierHash yang SAMA di epoch yang sama WAJIB ditolak (429)!
    const spamContent = 'Confession kedua dalam epoch yang sama harus ditolak.';
    const spamContentHash = canonicalHash(spamContent);
    const spamZkProof = createAnonymousSignalProof({
      identity,
      merkleProof,
      signal: spamContentHash,
      epoch,
      scope: 'confess',
    });

    const spamRes = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      payload: {
        category: 'deep',
        content: spamContent,
        zkProof: spamZkProof,
      },
    });

    assert.equal(spamRes.statusCode, 429);
    assert.equal(spamRes.json().error.code, 'RATE_LIMIT_EXCEEDED');
  });
});
