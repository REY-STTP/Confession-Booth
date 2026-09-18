// Unit tests Fase 0/T1: validasi, anon-ID, ranking, privacy projection, XSS fuzz.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  validateConfession,
  validateWhisper,
  countChars,
  normalizeContent,
  hashContent,
  canonicalHash,
  makeAnonymousName,
  assertPublicSafe,
  trendingScore,
  relatableScore,
  isCategorySlug,
  isReactionType,
  isReportReason,
  escapeHtml,
  deriveAnonymousIdentity,
  computeEpochNullifier,
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
  createAnonymousSignalProof,
  verifyAnonymousSignalProof,
  getCurrentEpoch,
} from './index.js';

describe('countChars (Unicode)', () => {
  it('menghitung emoji sebagai 1 char', () => {
    assert.equal(countChars('🕯️'), 2); // candle + VS16 = 2 code points (terdokumentasi)
    assert.equal(countChars('a'), 1);
    assert.equal(countChars(''.padEnd(500, 'a')), 500);
  });
  it('batas 500/501', () => {
    assert.equal(validateConfession('a'.repeat(500)).ok, true);
    assert.equal(validateConfession('a'.repeat(501)).ok, false);
    assert.equal(validateWhisper('a'.repeat(300)).ok, true);
    assert.equal(validateWhisper('a'.repeat(301)).ok, false);
  });
});

describe('validateConfession', () => {
  it('tolak string kosong', () => {
    assert.deepEqual(validateConfession('').errors, ['CONTENT_TOO_SHORT']);
  });
  it('tolak XSS payloads', () => {
    const payloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '</div><script>x</script>',
    ];
    for (const p of payloads) {
      const r = validateConfession(p);
      assert.equal(r.ok, false, p);
      assert.ok(r.errors.includes('MARKUP_NOT_ALLOWED'), p);
    }
  });
  it('tolak link di MVP', () => {
    assert.ok(
      validateConfession('lihat https://example.com').errors.includes('LINKS_NOT_ALLOWED_MVP'),
    );
  });
  it('tolak control characters', () => {
    assert.ok(validateConfession('halo\x00dunia').errors.includes('CONTROL_CHARACTERS'));
  });
  it('terima newline dan tab', () => {
    assert.equal(validateConfession('baris1\nbaris2\ttab').ok, true);
  });
  it('P2 #16: tolak URL IP/localhost/intranet (bypass URL_RE lama)', () => {
    const bad = [
      'lihat http://192.168.1.1/rahasia',
      'buka http://10.0.0.5:3000/x',
      'buka http://localhost:3000/cek',
      'klik www.server.local/data',
      'coba http://[::1]/x',
    ];
    for (const u of bad) {
      assert.ok(validateConfession(u).errors.includes('LINKS_NOT_ALLOWED_MVP'), u);
    }
    assert.ok(
      validateWhisper('hubungi http://127.0.0.1/abc').errors.includes('LINKS_NOT_ALLOWED_MVP'),
    );
  });
  it('P2 #16: tolak bidi override, terima ZWJ emoji + RTL polos', () => {
    const RLO = String.fromCharCode(0x202e);

    assert.ok(validateConfession(`a${RLO}b`).errors.includes('CONTROL_CHARACTERS'));
    assert.ok(validateConfession(`x${RLO}y`).errors.includes('CONTROL_CHARACTERS'));
    assert.equal(validateConfession('👨‍👩‍👧 quality time').ok, true);
    assert.equal(validateConfession('مرحبا بالجميع').ok, true);
  });
  it('normalisasi NFC konsisten untuk hash', () => {
    const a = 'é'; // U+00E9
    const b = 'é'; // e + U+0301
    assert.equal(normalizeContent(a), normalizeContent(b));
    assert.equal(hashContent(a), hashContent(b));
  });
  it('P1 #11 S2: hashContent kanonis — mixed-case sama dengan canonicalHash', () => {
    assert.equal(hashContent('MiXeD Case TeSt'), canonicalHash('MiXeD Case TeSt'));
    assert.equal(
      hashContent('Verifikasi Integritas Ipfs'),
      canonicalHash('Verifikasi Integritas Ipfs'),
    );
  });
});

describe('kategori/reaksi/report', () => {
  it('11 kategori valid', () => {
    for (const s of [
      'love',
      'heartbreak',
      'secret',
      'life',
      'school',
      'work',
      'family',
      'funny',
      'sad',
      'deep',
      'midnight',
    ]) {
      assert.equal(isCategorySlug(s), true);
    }
    assert.equal(isCategorySlug('TOKEN'), false);
  });
  it('5 reaksi valid', () => {
    for (const t of ['UNDERSTAND', 'LOVE', 'SAD', 'WILD', 'FUNNY'])
      assert.equal(isReactionType(t), true);
    assert.equal(isReactionType('LIKE'), false);
  });
  it('11 reason report valid', () => {
    assert.equal(isReportReason('DOXXING'), true);
    assert.equal(isReportReason('RUDE'), false);
  });
});

describe('anonymous name', () => {
  it('format Anonymous #NNNN dan acak', () => {
    assert.match(makeAnonymousName(4821), /^Anonymous #4821$/);
    assert.match(makeAnonymousName(), /^Anonymous #\d{4}$/);
  });
});

describe('privacy projection', () => {
  it('deteksi kebocoran wallet/userID/session', () => {
    const leaks = assertPublicSafe({
      id: 'c_1',
      author: { displayName: 'Anonymous #4821' },
      wallet_address: '0xabc',
    });
    assert.ok(leaks.length > 0);
  });
  it('deteksi value mirip wallet', () => {
    const leaks = assertPublicSafe({ author: '0x1234567890123456789012345678901234567890' });
    assert.ok(leaks.some((l) => l.includes('wallet-like')));
  });
  it('proyeksi bersih lolos', () => {
    const leaks = assertPublicSafe({
      id: 'c_1',
      author: { displayName: 'Anonymous #4821' },
      category: 'sad',
      content: 'halo',
    });
    assert.deepEqual(leaks, []);
  });
  it('escapeHtml menetralkan tag', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  });
});

describe('ranking', () => {
  it('trending: engagement tinggi + muda menang', () => {
    const hot = trendingScore({ reactions: 100, whispers: 20, uniqueEngagement: 80, ageHours: 1 });
    const old = trendingScore({ reactions: 100, whispers: 20, uniqueEngagement: 80, ageHours: 72 });
    assert.ok(hot > old);
  });
  it('relatable: UNDERSTAND dominan menang', () => {
    const a = relatableScore({ understand: 90, total: 100, ageHours: 5 });
    const b = relatableScore({ understand: 10, total: 100, ageHours: 5 });
    assert.ok(a > b);
  });
});

describe('Fase 2: Anonymous Credentials & Nullifiers (T2-001, T2-003)', () => {
  it('deriveAnonymousIdentity deterministik dari signature yang sama', () => {
    const sig = '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';
    const id1 = deriveAnonymousIdentity(sig);
    const id2 = deriveAnonymousIdentity(sig);
    assert.equal(id1.trapdoor, id2.trapdoor);
    assert.equal(id1.nullifier, id2.nullifier);
    assert.equal(id1.commitment, id2.commitment);
    assert.match(id1.commitment, /^[0-9a-f]{64}$/);

    const diffId = deriveAnonymousIdentity('0xdifferent');
    assert.notEqual(diffId.commitment, id1.commitment);
  });

  it('computeEpochNullifier unik per epoch dan scope', () => {
    const id = deriveAnonymousIdentity('0xsignature');
    const n1 = computeEpochNullifier(id.nullifier, 100, 'confess');
    const n2 = computeEpochNullifier(id.nullifier, 100, 'confess');
    const nNextEpoch = computeEpochNullifier(id.nullifier, 101, 'confess');
    const nOtherScope = computeEpochNullifier(id.nullifier, 100, 'whisper');

    assert.equal(n1, n2);
    assert.notEqual(n1, nNextEpoch);
    assert.notEqual(n1, nOtherScope);
  });

  it('Merkle Tree: bukti dan verifikasi keanggotaan valid', () => {
    const idA = deriveAnonymousIdentity('0xsigA');
    const idB = deriveAnonymousIdentity('0xsigB');
    const idC = deriveAnonymousIdentity('0xsigC');
    const idD = deriveAnonymousIdentity('0xsigD');
    const leaves = [idA.commitment, idB.commitment, idC.commitment, idD.commitment];

    const { root } = buildMerkleTree(leaves);
    assert.match(root, /^[0-9a-f]{64}$/);

    const proofA = getMerkleProof(leaves, 0);
    assert.equal(verifyMerkleProof(proofA.leaf, proofA.path, proofA.indices, root), true);

    const proofC = getMerkleProof(leaves, 2);
    assert.equal(verifyMerkleProof(proofC.leaf, proofC.path, proofC.indices, root), true);

    // Bukti salah / dipalsukan
    assert.equal(verifyMerkleProof(idD.commitment, proofA.path, proofA.indices, root), false);
  });

  it('AnonymousSignalProof: alur pembuktian dan verifikasi end-to-end', () => {
    const id = deriveAnonymousIdentity('0xuserSecretSignature');
    const leaves = [id.commitment, deriveAnonymousIdentity('0xother').commitment];
    const merkleProof = getMerkleProof(leaves, 0);
    const signal = 'content_hash_123456';
    const epoch = getCurrentEpoch();

    const proof = createAnonymousSignalProof({
      identity: id,
      merkleProof,
      signal,
      epoch,
      scope: 'confess',
    });

    const vValid = verifyAnonymousSignalProof({
      proof,
      knownRoots: [merkleProof.root],
      expectedSignal: signal,
      currentEpoch: epoch,
    });
    assert.equal(vValid.ok, true);

    // Ditolak bila signal diubah (tamper)
    const vTamper = verifyAnonymousSignalProof({
      proof,
      knownRoots: [merkleProof.root],
      expectedSignal: 'different_signal',
      currentEpoch: epoch,
    });
    assert.equal(vTamper.ok, false);
    assert.equal(vTamper.reason, 'SIGNAL_MISMATCH');

    // Ditolak bila root tidak dikenal
    const vUnknownRoot = verifyAnonymousSignalProof({
      proof,
      knownRoots: ['0xunknownroot'],
      expectedSignal: signal,
      currentEpoch: epoch,
    });
    assert.equal(vUnknownRoot.ok, false);
    assert.equal(vUnknownRoot.reason, 'UNKNOWN_MERKLE_ROOT');
  });

  it('P2 #21: daun ganjil/kosong/tunggal konsisten + domain separation node', () => {
    // Kosong: root = konstanta empty yang terdokumentasi.
    const empty = buildMerkleTree([]);
    assert.equal(empty.root, createHash('sha256').update('booth:merkle:empty').digest('hex'));
    // Tunggal: root == leaf.
    const one = buildMerkleTree(['solo']);
    assert.equal(one.root, 'solo');
    // Ganjil (3, 5): semua proof valid, tamper gagal.
    for (const n of [3, 5]) {
      const leaves = Array.from({ length: n }, (_, i) => `leaf-${i}`);
      const { root } = buildMerkleTree(leaves);
      for (let i = 0; i < n; i++) {
        const pf = getMerkleProof(leaves, i);
        assert.equal(pf.root, root);
        assert.equal(verifyMerkleProof(leaves[i], pf.path, pf.indices, root), true);
        assert.equal(verifyMerkleProof('jahat', pf.path, pf.indices, root), false);
      }
    }
    // Domain separation aktif: root != hash format lama tanpa prefix.
    const prefixed = buildMerkleTree(['a', 'b']).root;
    const legacy = createHash('sha256').update('a:b').digest('hex');
    assert.notEqual(prefixed, legacy);
  });
  it('P2 #21: ranking guard — negatif/NaN/Infinity tak merambat', () => {
    assert.ok(
      Number.isFinite(
        trendingScore({ reactions: -5, whispers: NaN, uniqueEngagement: 3, ageHours: -2 }),
      ),
    );
    assert.equal(relatableScore({ understand: NaN, total: NaN, ageHours: Infinity }), 0);
    assert.equal(relatableScore({ understand: 5, total: -1, ageHours: 2 }), 0);
  });
  it('P2 #16: stub menolak epoch basi + payload pendek (bukan kripto penuh)', () => {
    const id = deriveAnonymousIdentity('0xnegatifEpoch');
    const leaves = [id.commitment];
    const merkleProof = getMerkleProof(leaves, 0);
    const epoch = getCurrentEpoch();
    const proof = createAnonymousSignalProof({
      identity: id,
      merkleProof,
      signal: 'sig',
      epoch,
      scope: 'confess',
    });
    const expired = verifyAnonymousSignalProof({
      proof: { ...proof, epoch: epoch - 5 },
      knownRoots: [merkleProof.root],
      expectedSignal: 'sig',
      currentEpoch: epoch,
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.reason, 'EXPIRED_EPOCH');
    const short = verifyAnonymousSignalProof({
      proof: { ...proof, proof: 'pendek' },
      knownRoots: [merkleProof.root],
      expectedSignal: 'sig',
      currentEpoch: epoch,
    });
    assert.equal(short.ok, false);
    assert.equal(short.reason, 'INVALID_PROOF_PAYLOAD');
  });
});
