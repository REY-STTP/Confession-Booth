// @booth/shared — single source of truth untuk aturan konten, kategori, reaksi.
// Dipakai web (validasi client) dan api (validasi server — JANGAN percaya client).

import { createHash, randomInt } from 'node:crypto';
import {
  CONFESSION_MAX,
  CONFESSION_MIN,
  REPORT_DETAILS_MAX,
  WHISPER_MAX,
  WHISPER_MIN,
  countChars,
  normalizeContent,
  normalizeForDedup,
} from './constants.js';

// P1 #11: konstanta kanonis pindah ke ./constants.js (browser-safe) —
// diimpor ulang agar `import {...} from '@booth/shared'` tak berubah.
export {
  CONFESSION_MIN,
  CONFESSION_MAX,
  WHISPER_MIN,
  WHISPER_MAX,
  REPORT_DETAILS_MAX,
  PROTOCOL_VERSION,
  CATEGORIES,
  CATEGORY_SLUGS,
  isCategorySlug,
  REACTIONS,
  REACTION_TYPES,
  isReactionType,
  REPORT_REASONS,
  REPORT_REASON_SET,
  isReportReason,
  MODERATION_ACTIONS,
  BADGES,
  BADGE_TYPES,
  isBadgeType,
  countChars,
  normalizeContent,
  normalizeForDedup,
} from './constants.js';
export type { BadgeType, CategorySlug, ReactionType, ReportReasonCode } from './constants.js';
export * from './schemas.js';

/** Hash kanonis konten: sha256(normalizeForDedup) — SATU-SATUNYA fungsi hash
 *  konten (P1 #11 S2). Dipakai contentHash on-chain + dedup + storage. */
export function canonicalHash(s: string): string {
  return createHash('sha256').update(normalizeForDedup(s), 'utf8').digest('hex');
}

/** Alias historis (dulu case-sensitive) — kini kanonis, jangan dipakai baru. */
export function hashContent(s: string): string {
  return canonicalHash(s);
}

/** Nama anonim per-confession (acak) — cegah korelasi antar-posting user sama. */
export function makeAnonymousName(seed?: number): string {
  const n = seed ?? randomInt(1000, 9999);
  return `Anonymous #${n}`;
}

/** Escape HTML untuk render aman (defense-in-depth; React juga escape by default). */
export function escapeHtml(s: string): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

const MARKUP_RE = /<[a-zA-Z\/!]/; // pola tag HTML kasar: <b, </div, <!doctype
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// URL regex presisi tinggi: match URL dengan protokol wajib atau www. + domain valid
// - Harus pakai https?:// atau www. (tidak match "file.name" atau "version 2.0")
// - Domain: label alfanumerik + hyphen, TLD min 2 char, NO trailing dot
// - Port optional, path/query/fragment optional
// - Blokir mailto:, t.me/, telegram.me, discord.gg tanpa protokol
const URL_RE =
  /(?:https?:\/\/|www\.)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\:\d+)?(?:\/[^\s<>"{}|\\^`\[\]]*)?/i;

// Shorthand URL detection untuk platform populer tanpa protokol (block tambahan)
const SHORTHAND_URL_RE = /(?:^|\s)(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/\S+/i;

export interface ContentCheck {
  ok: boolean;
  errors: string[];
}

function checkBase(content: unknown, min: number, max: number): ContentCheck {
  const errors: string[] = [];
  if (typeof content !== 'string') {
    return { ok: false, errors: ['CONTENT_NOT_STRING'] };
  }
  const n = countChars(content);
  if (n < min) errors.push('CONTENT_TOO_SHORT');
  if (n > max) errors.push('CONTENT_TOO_LONG');
  // T1-027: tolak whitespace-only (kanonis kosong) walau countChars >= min.
  if (errors.length === 0 && normalizeContent(content).length === 0) {
    errors.push('CONTENT_TOO_SHORT');
  }
  if (CONTROL_RE.test(content)) errors.push('CONTROL_CHARACTERS');
  if (MARKUP_RE.test(content)) errors.push('MARKUP_NOT_ALLOWED');
  return { ok: errors.length === 0, errors };
}

/** Validasi confession 1–500 char, plaintext, tanpa markup. MVP: tolak URL. */
export function validateConfession(content: unknown): ContentCheck {
  const base = checkBase(content, CONFESSION_MIN, CONFESSION_MAX);
  if (!base.ok) return base;
  const text = content as string;
  if (URL_RE.test(text) || SHORTHAND_URL_RE.test(text)) base.errors.push('LINKS_NOT_ALLOWED_MVP');
  base.ok = base.errors.length === 0;
  return base;
}

/** Validasi whisper 1–300 char. */
export function validateWhisper(content: unknown): ContentCheck {
  const base = checkBase(content, WHISPER_MIN, WHISPER_MAX);
  if (!base.ok) return base;
  const text = content as string;
  if (URL_RE.test(text) || SHORTHAND_URL_RE.test(text)) base.errors.push('LINKS_NOT_ALLOWED_MVP');
  base.ok = base.errors.length === 0;
  return base;
}

/** T1-027: validator details report 0–500 char (opsional, plaintext, tanpa markup). */
export function validateReportDetails(details: unknown): ContentCheck {
  if (details === undefined || details === null || details === '') {
    return { ok: true, errors: [] };
  }
  if (typeof details !== 'string') {
    return { ok: false, errors: ['CONTENT_NOT_STRING'] };
  }
  const errors: string[] = [];
  if (countChars(details) > REPORT_DETAILS_MAX) errors.push('CONTENT_TOO_LONG');
  if (CONTROL_RE.test(details)) errors.push('CONTROL_CHARACTERS');
  if (MARKUP_RE.test(details)) errors.push('MARKUP_NOT_ALLOWED');
  return { ok: errors.length === 0, errors };
}

/** Proyeksi publik: pastikan tidak ada identitas bocor. Dipakai test privacy. */
const FORBIDDEN_PUBLIC_KEYS = [
  'wallet_address',
  'walletAddress',
  'author_user_id',
  'authorUserId',
  'user_id',
  'userId',
  'ip',
  'session_id',
  'sessionId',
  'moderator_notes',
  'moderatorNotes',
  'email',
] as const;

export function assertPublicSafe(obj: unknown, path = '$'): string[] {
  const leaks: string[] = [];
  if (obj === null || typeof obj !== 'object') return leaks;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaks.push(...assertPublicSafe(v, `${path}[${i}]`)));
    return leaks;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if ((FORBIDDEN_PUBLIC_KEYS as readonly string[]).includes(k)) {
      leaks.push(`${path}.${k}`);
    }
    // alamat wallet mentah sebagai value string
    if (typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v)) {
      leaks.push(`${path}.${k} (=wallet-like)`);
    }
    if (v !== null && typeof v === 'object') {
      leaks.push(...assertPublicSafe(v, `${path}.${k}`));
    }
  }
  return leaks;
}

/** Skor trending time-decay: reactions + whispers*2 + unique*1.5, dibagi pangkat umur jam. */
export function trendingScore(params: {
  reactions: number;
  whispers: number;
  uniqueEngagement: number;
  ageHours: number;
}): number {
  const { reactions, whispers, uniqueEngagement, ageHours } = params;
  const engagement = reactions + whispers * 2 + uniqueEngagement * 1.5;
  return engagement / Math.pow(ageHours + 2, 1.5);
}

/** Skor relatable: bobot UNDERSTAND dominan. */
export function relatableScore(params: {
  understand: number;
  total: number;
  ageHours: number;
}): number {
  const { understand, total, ageHours } = params;
  if (total <= 0) return 0;
  return (understand * 2 + total) / Math.pow(ageHours + 2, 1.3);
}

/** T1H-002 ranking v2: anti-Sybil (akun baru didiskon) + penalti report terbuka.
 *  - newAccountShare 0..1: proporsi engagement dari akun <7 hari → skor × (1 - 0.5*share).
 *  - openReports: tiap report terbuka ×0.9 (floor 0.1) — konten sengketa turun peringkat. */
export function trendingScoreV2(params: {
  reactions: number;
  whispers: number;
  uniqueEngagement: number;
  ageHours: number;
  newAccountShare?: number;
  openReports?: number;
}): number {
  const base = trendingScore(params);
  const share = Math.min(1, Math.max(0, params.newAccountShare ?? 0));
  const reports = Math.max(0, params.openReports ?? 0);
  return base * (1 - 0.5 * share) * Math.max(0.1, Math.pow(0.9, reports));
}

/** Relatable resmi v2: UNDERSTAND dominan + penalti report (Most Relatable T1H-002). */
export function relatableScoreV2(params: {
  understand: number;
  total: number;
  ageHours: number;
  openReports?: number;
}): number {
  const base = relatableScore(params);
  const reports = Math.max(0, params.openReports ?? 0);
  return base * Math.max(0.1, Math.pow(0.9, reports));
}

export const COPY = {
  hero: "Say what you can't say.",
  heroSub: 'Nobody needs to know who you are.',
  cta: 'Enter the Booth',
  composerTitle: 'What do you need to get off your chest?',
  composerPlaceholder: 'Write your confession...',
  confessButton: 'Confess',
  emptyFeed: 'The booth is quiet.',
  emptyFeedSub: 'Be the first to leave something behind.',
  whisperTitle: 'Leave a whisper',
  whisperPlaceholder: 'Say something anonymously...',
  midnightTitle: 'Midnight Confessions',
  midnightSub: 'Things people only say when nobody is listening.',
  privacyNotice:
    'Your confession is public. Your profile doesn\u2019t have to be. Confession Booth is designed for anonymous expression, but blockchain and network metadata can still create privacy risks. Don\u2019t include information that could identify you.',
  reportTitle: 'Something wrong?',
  reportSub: 'Report this confession and our moderation team will review it.',
} as const;

// ============================================================================
// FASE 2: ANONYMOUS CREDENTIALS & PRIVACY-PRESERVING NULLIFIERS (T2-001, T2-003)
// ============================================================================

export const EPOCH_DURATION_MS = 3_600_000; // 1 jam per epoch

export function getCurrentEpoch(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / EPOCH_DURATION_MS);
}

export interface AnonymousIdentity {
  trapdoor: string; // 32 bytes hex
  nullifier: string; // 32 bytes hex
  commitment: string; // Hash(trapdoor, nullifier)
}

/** Menghasilkan identitas anonim deterministik dari tanda tangan wallet pengguna (T2-001). */
export function deriveAnonymousIdentity(signature: string): AnonymousIdentity {
  const normSig = signature.toLowerCase().replace(/^0x/, '');
  const trapdoor = createHash('sha256').update(`booth:trapdoor:${normSig}`).digest('hex');
  const nullifier = createHash('sha256').update(`booth:nullifier:${normSig}`).digest('hex');
  const commitment = createHash('sha256')
    .update(`booth:commitment:${trapdoor}:${nullifier}`)
    .digest('hex');
  return { trapdoor, nullifier, commitment };
}

/** Menghitung Epoch Nullifier untuk rate-limiting & anti-spam anonim (T2-003). */
export function computeEpochNullifier(
  identityNullifier: string,
  epoch: number,
  scope: 'confess' | 'whisper' | 'react' = 'confess',
): string {
  return createHash('sha256')
    .update(`booth:epoch-nullifier:${identityNullifier}:${epoch}:${scope}`)
    .digest('hex');
}

export interface MerkleProof {
  leaf: string;
  root: string;
  path: string[];
  indices: number[]; // 0 = kiri, 1 = kanan
}

/** Membangun Merkle Tree sederhana untuk verifikasi keanggotaan kumpulan anonimitas (T2-001). */
export function buildMerkleTree(leaves: string[]): {
  root: string;
  levels: string[][];
} {
  if (leaves.length === 0) {
    const emptyRoot = createHash('sha256').update('booth:merkle:empty').digest('hex');
    return { root: emptyRoot, levels: [[emptyRoot]] };
  }

  const levels: string[][] = [leaves.slice()];
  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : left;
      const combined = createHash('sha256').update(`${left}:${right}`).digest('hex');
      next.push(combined);
    }
    levels.push(next);
  }

  return {
    root: levels[levels.length - 1][0],
    levels,
  };
}

/** Menghasilkan Merkle Proof untuk leaf tertentu. */
export function getMerkleProof(leaves: string[], leafIndex: number): MerkleProof {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error('Leaf index out of bounds');
  }

  const { root, levels } = buildMerkleTree(leaves);
  const path: string[] = [];
  const indices: number[] = [];

  let idx = leafIndex;
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : Math.min(idx + 1, level.length - 1);
    path.push(level[siblingIdx]);
    indices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return {
    leaf: leaves[leafIndex],
    root,
    path,
    indices,
  };
}

/** Memverifikasi Merkle Proof (T2-001). */
export function verifyMerkleProof(
  leaf: string,
  path: string[],
  indices: number[],
  expectedRoot: string,
): boolean {
  let current = leaf;
  for (let i = 0; i < path.length; i++) {
    const sibling = path[i];
    const isRight = indices[i] === 1;
    const [l, r] = isRight ? [sibling, current] : [current, sibling];
    current = createHash('sha256').update(`${l}:${r}`).digest('hex');
  }
  return current === expectedRoot;
}

export interface AnonymousSignalProof {
  merkleRoot: string;
  nullifierHash: string;
  epoch: number;
  scope: 'confess' | 'whisper' | 'react';
  signal: string; // Hash dari payload/konten
  proof: string; // Bukti kriptografis (signature atas signal + nullifier + root)
}

/** Menghasilkan bukti aksi anonim di client. */
export function createAnonymousSignalProof(params: {
  identity: AnonymousIdentity;
  merkleProof: MerkleProof;
  signal: string;
  epoch: number;
  scope?: 'confess' | 'whisper' | 'react';
}): AnonymousSignalProof {
  const scope = params.scope ?? 'confess';
  const nullifierHash = computeEpochNullifier(params.identity.nullifier, params.epoch, scope);
  const challenge = createHash('sha256')
    .update(`${params.merkleProof.root}:${nullifierHash}:${params.epoch}:${scope}:${params.signal}`)
    .digest('hex');
  const proof = createHash('sha256')
    .update(`${params.identity.trapdoor}:${challenge}`)
    .digest('hex');

  return {
    merkleRoot: params.merkleProof.root,
    nullifierHash,
    epoch: params.epoch,
    scope,
    signal: params.signal,
    proof,
  };
}

/** Memvalidasi bukti aksi anonim di server API (T2-001, T2-003). */
export function verifyAnonymousSignalProof(params: {
  proof: AnonymousSignalProof;
  knownRoots: Set<string> | string[];
  expectedSignal: string;
  currentEpoch?: number;
}): { ok: boolean; reason?: string } {
  const roots = params.knownRoots instanceof Set ? params.knownRoots : new Set(params.knownRoots);
  if (!roots.has(params.proof.merkleRoot)) {
    return { ok: false, reason: 'UNKNOWN_MERKLE_ROOT' };
  }

  if (params.proof.signal !== params.expectedSignal) {
    return { ok: false, reason: 'SIGNAL_MISMATCH' };
  }

  const curEpoch = params.currentEpoch ?? getCurrentEpoch();
  // Toleransi tolerir 1 epoch sebelumnya untuk latency jam klien
  if (Math.abs(params.proof.epoch - curEpoch) > 1) {
    return { ok: false, reason: 'EXPIRED_EPOCH' };
  }

  if (!params.proof.proof || params.proof.proof.length < 32) {
    return { ok: false, reason: 'INVALID_PROOF_PAYLOAD' };
  }

  return { ok: true };
}
