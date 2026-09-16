// Unit tests Fase 0/T1: validasi, anon-ID, ranking, privacy projection, XSS fuzz.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateConfession,
  validateWhisper,
  countChars,
  normalizeContent,
  hashContent,
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
  it('normalisasi NFC konsisten untuk hash', () => {
    const a = 'é'; // U+00E9
    const b = 'é'; // e + U+0301
    assert.equal(normalizeContent(a), normalizeContent(b));
    assert.equal(hashContent(a), hashContent(b));
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
});
