// @booth/shared — single source of truth untuk aturan konten, kategori, reaksi.
// Dipakai web (validasi client) dan api (validasi server — JANGAN percaya client).

import { createHash, randomInt } from 'node:crypto';

export const CONFESSION_MIN = 1;
export const CONFESSION_MAX = 500;
export const WHISPER_MIN = 1;
export const WHISPER_MAX = 300;
export const REPORT_DETAILS_MAX = 500;

export const CATEGORIES = [
  { slug: 'love', name: 'Love', sort_order: 1 },
  { slug: 'heartbreak', name: 'Heartbreak', sort_order: 2 },
  { slug: 'secret', name: 'Secret', sort_order: 3 },
  { slug: 'life', name: 'Life', sort_order: 4 },
  { slug: 'school', name: 'School', sort_order: 5 },
  { slug: 'work', name: 'Work', sort_order: 6 },
  { slug: 'family', name: 'Family', sort_order: 7 },
  { slug: 'funny', name: 'Funny', sort_order: 8 },
  { slug: 'sad', name: 'Sad', sort_order: 9 },
  { slug: 'deep', name: 'Deep', sort_order: 10 },
  { slug: 'midnight', name: 'Midnight', sort_order: 11 },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
export const CATEGORY_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));
export function isCategorySlug(v: unknown): v is CategorySlug {
  return typeof v === 'string' && CATEGORY_SLUGS.has(v);
}

export const REACTIONS = [
  { type: 'UNDERSTAND', emoji: '🕯️', label: 'I understand' },
  { type: 'LOVE', emoji: '❤️', label: 'Sending love' },
  { type: 'SAD', emoji: '😭', label: 'I feel this' },
  { type: 'WILD', emoji: '💀', label: "That's wild" },
  { type: 'FUNNY', emoji: '😂', label: "I shouldn't laugh" },
] as const;

export type ReactionType = (typeof REACTIONS)[number]['type'];
export const REACTION_TYPES = new Set<string>(REACTIONS.map((r) => r.type));
export function isReactionType(v: unknown): v is ReactionType {
  return typeof v === 'string' && REACTION_TYPES.has(v);
}

export const REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'HATE',
  'THREAT',
  'DOXXING',
  'SEXUAL_EXPLOITATION',
  'SELF_HARM',
  'FRAUD',
  'MALWARE',
  'ILLEGAL_ACTIVITY',
  'OTHER',
] as const;
export type ReportReasonCode = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_SET = new Set<string>(REPORT_REASONS);
export function isReportReason(v: unknown): v is ReportReasonCode {
  return typeof v === 'string' && REPORT_REASON_SET.has(v);
}

export const MODERATION_ACTIONS = [
  'DISMISS',
  'HIDE',
  'REMOVE',
  'RESTRICT',
  'BAN',
  'RESTORE',
] as const;

/** Hitung karakter Unicode (code point) — benar untuk emoji/ZWJ. */
export function countChars(s: string): number {
  return Array.from(s ?? '').length;
}

/** Normalisasi kanonis: NFC + collapse whitespace + trim. */
export function normalizeContent(s: string): string {
  return (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Normalisasi untuk deteksi duplikat: lowercase + collapse + trim. */
export function normalizeForDedup(s: string): string {
  return normalizeContent(s).toLowerCase();
}

/** sha256 hex dari konten kanonis. Dipakai untuk contentHash + dedup. */
export function hashContent(s: string): string {
  return createHash('sha256').update(normalizeContent(s), 'utf8').digest('hex');
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
const URL_RE = /https?:\/\/|www\./i;

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
  if (URL_RE.test(content as string)) base.errors.push('LINKS_NOT_ALLOWED_MVP');
  base.ok = base.errors.length === 0;
  return base;
}

/** Validasi whisper 1–300 char. */
export function validateWhisper(content: unknown): ContentCheck {
  const base = checkBase(content, WHISPER_MIN, WHISPER_MAX);
  if (!base.ok) return base;
  if (URL_RE.test(content as string)) base.errors.push('LINKS_NOT_ALLOWED_MVP');
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
export function relatableScore(params: { understand: number; total: number; ageHours: number }): number {
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
