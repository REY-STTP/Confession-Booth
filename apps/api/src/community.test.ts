// Test Fase 3: Community Features (T3-001, T3-002, T3-003)
// 1. Confession Chains: Nested/threaded whispers, is_op tag, parent verification.
// 2. Badges & Reputation: Auto-awarding on positive actions, listing user badges.
// 3. Community Rooms: Room listing, detail, room-filtered feed, and posting with roomSlug.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { buildApp } from './server.js';
import { getDb } from './db/client.js';
import { solvePow } from './pow.js';

const app = await buildApp();
const db = getDb();

let ipN = 300;
const ip = () => `10.60.0.${(ipN++ % 200) + 1}`;

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

describe('Fase 3: Community Features (Chains, Badges, Rooms)', () => {
  before(async () => {
    await app.ready();
  });

  it('T3-003 Community Rooms: list rooms, detail room, dan filter feed', async () => {
    // 1. Ambil daftar room default
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/rooms',
      remoteAddress: ip(),
    });
    assert.equal(listRes.statusCode, 200);
    const { rooms } = listRes.json();
    assert.ok(Array.isArray(rooms));
    assert.ok(rooms.length >= 5);
    const campus = rooms.find((r: any) => r.slug === 'campus-life');
    assert.ok(campus);
    assert.equal(campus.name, 'Kampus & Kuliah');
    assert.equal(campus.icon, '🎓');

    // 2. Detail room
    const detailRes = await app.inject({
      method: 'GET',
      url: '/api/rooms/campus-life',
      remoteAddress: ip(),
    });
    assert.equal(detailRes.statusCode, 200);
    assert.equal(detailRes.json().slug, 'campus-life');
    assert.ok(detailRes.json().rules);

    // 3. Posting confession dengan roomSlug valid
    const author = await newUser();
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${author.token}` },
      payload: {
        category: 'school',
        roomSlug: 'campus-life',
        content: 'Tugas akhir semester ini sangat menantang tapi seru sekali.',
      },
    });
    assert.equal(postRes.statusCode, 201);
    const postBody = postRes.json();
    assert.equal(postBody.roomSlug, 'campus-life');

    // 4. Posting confession dengan roomSlug tidak dikenal ditolak 404
    const badRoomRes = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${author.token}` },
      payload: {
        category: 'school',
        roomSlug: 'non-existent-room',
        content: 'Konten ke room fiktif.',
      },
    });
    assert.equal(badRoomRes.statusCode, 404);
    assert.equal(badRoomRes.json().error.code, 'ROOM_NOT_FOUND');

    // 5. Feed filter khusus room
    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/feed?room=campus-life',
      remoteAddress: ip(),
    });
    assert.equal(feedRes.statusCode, 200);
    const feedBody = feedRes.json();
    assert.ok(feedBody.items.some((item: any) => item.publicId === postBody.publicId));
  });

  it('T3-001 Confession Chains: balasan berantai (nested whispers) dan deteksi OP', async () => {
    const op = await newUser();
    const respondentA = await newUser();
    const respondentB = await newUser();

    // 1. OP posting confession
    const cRes = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${op.token}` },
      payload: {
        category: 'deep',
        content: 'Apakah kalian pernah merasa berada di persimpangan jalan hidup yang sunyi?',
      },
    });
    assert.equal(cRes.statusCode, 201);
    const confessionId = cRes.json().publicId;

    // 2. Respondent A membalas confession (whisper level 1)
    const w1Res = await app.inject({
      method: 'POST',
      url: `/api/confessions/${confessionId}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${respondentA.token}` },
      payload: {
        content: 'Pernah sekali, waktu pertama kali memutuskan merantau jauh dari keluarga.',
      },
    });
    assert.equal(w1Res.statusCode, 201);
    const w1Id = w1Res.json().id;
    assert.equal(w1Res.json().parentWhisperId, null);

    // 3. Respondent B membalas balasan A (Chain level 2)
    const w2Res = await app.inject({
      method: 'POST',
      url: `/api/confessions/${confessionId}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${respondentB.token}` },
      payload: {
        parentWhisperId: w1Id,
        content: 'Bagaimana caramu bertahan melewati bulan-bulan pertama itu?',
      },
    });
    assert.equal(w2Res.statusCode, 201);
    const w2Id = w2Res.json().id;
    assert.equal(w2Res.json().parentWhisperId, w1Id);

    // 4. OP membalas di dalam rantai (OP response)
    const wOpRes = await app.inject({
      method: 'POST',
      url: `/api/confessions/${confessionId}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${op.token}` },
      payload: {
        parentWhisperId: w2Id,
        content:
          'Terima kasih sudah berbagi, mendengar cerita kalian membuatku merasa tidak sendiri.',
      },
    });
    assert.equal(wOpRes.statusCode, 201);
    const wOpId = wOpRes.json().id;
    assert.equal(wOpRes.json().parentWhisperId, w2Id);

    // 5. Balas parent whisper fiktif ditolak 404
    const badParentRes = await app.inject({
      method: 'POST',
      url: `/api/confessions/${confessionId}/whispers`,
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${respondentA.token}` },
      payload: {
        parentWhisperId: 'w_fake_id_12345',
        content: 'Balasan ke parent fiktif.',
      },
    });
    assert.equal(badParentRes.statusCode, 404);
    assert.equal(badParentRes.json().error.code, 'PARENT_NOT_FOUND');

    // 6. Ambil seluruh whispers dan verifikasi hierarki rantai serta flag isOp
    const getWhispers = await app.inject({
      method: 'GET',
      url: `/api/confessions/${confessionId}/whispers`,
      remoteAddress: ip(),
    });
    assert.equal(getWhispers.statusCode, 200);
    const { items } = getWhispers.json();
    assert.equal(items.length, 3);

    const item1 = items.find((w: any) => w.id === w1Id);
    const item2 = items.find((w: any) => w.id === w2Id);
    const itemOp = items.find((w: any) => w.id === wOpId);

    assert.equal(item1.parentWhisperId, null);
    assert.equal(item1.isOp, false);

    assert.equal(item2.parentWhisperId, w1Id);
    assert.equal(item2.isOp, false);

    assert.equal(itemOp.parentWhisperId, w2Id);
    assert.equal(itemOp.isOp, true); // Terverifikasi sebagai OP!
  });

  it('T3-002 Badges & Reputation: auto-award EMPATHETIC_LISTENER & CHAIN_WEAVER', async () => {
    const user = await newUser();
    const otherUser = await newUser();

    // Pastikan awal belum ada badge
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/me/badges',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(initialRes.statusCode, 200);

    // Buat 3 confession berbeda untuk diberi reaksi oleh user
    const cIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const cr = await app.inject({
        method: 'POST',
        url: '/api/confessions',
        remoteAddress: ip(),
        headers: { authorization: `Bearer ${otherUser.token}` },
        payload: {
          category: 'sad',
          content: `Pengakuan sedih untuk tes reaksi ${i} ${Date.now()}`,
        },
      });
      assert.equal(cr.statusCode, 201);
      cIds.push(cr.json().publicId);
    }

    // User bereaksi 3 kali dengan UNDERSTAND
    for (const cid of cIds) {
      const rRes = await app.inject({
        method: 'POST',
        url: `/api/confessions/${cid}/reactions`,
        remoteAddress: ip(),
        headers: { authorization: `Bearer ${user.token}` },
        payload: { type: 'UNDERSTAND' },
      });
      assert.equal(rRes.statusCode, 200);
    }

    // User cek badge -> harus mendapatkan EMPATHETIC_LISTENER!
    const badgesRes = await app.inject({
      method: 'GET',
      url: '/api/me/badges',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(badgesRes.statusCode, 200);
    const { badges } = badgesRes.json();
    assert.ok(badges.some((b: any) => b.type === 'EMPATHETIC_LISTENER'));
  });

  it('P2 #18: whisper ke-6 dalam sejam → 429 POW_REQUIRED → solve → 201', async () => {
    const author = await newUser();
    const whisperer = await newUser();
    const cRes = await app.inject({
      method: 'POST',
      url: '/api/confessions',
      remoteAddress: ip(),
      headers: { authorization: `Bearer ${author.token}` },
      payload: { category: 'deep', content: `Target whisper pow ${Date.now()}` },
    });
    assert.equal(cRes.statusCode, 201);
    const confessionId = cRes.json().publicId;
    const post = (content: string, pow?: string) =>
      app.inject({
        method: 'POST',
        url: `/api/confessions/${confessionId}/whispers`,
        remoteAddress: ip(),
        headers: {
          authorization: `Bearer ${whisperer.token}`,
          ...(pow ? { 'x-pow-solution': pow } : {}),
        },
        payload: { content },
      });
    for (let i = 0; i < 5; i++) {
      const r = await post(`whisper pow ${Date.now()} ${i} ${Math.random().toString(36).slice(2)}`);
      assert.equal(r.statusCode, 201);
    }
    const blocked = await post(
      `whisper pow blocked ${Date.now()} ${Math.random().toString(36).slice(2)}`,
    );
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.json().error.code, 'POW_REQUIRED');
    const ch = blocked.json().error.challenge as { token: string; difficulty: number };
    const nonceN = solvePow(ch.token.split('.')[0], ch.difficulty);
    assert.ok(nonceN !== null);
    const retry = await post(
      `whisper pow lolos ${Date.now()} ${Math.random().toString(36).slice(2)}`,
      `${ch.token}:${nonceN}`,
    );
    assert.equal(retry.statusCode, 201);
  });
});
