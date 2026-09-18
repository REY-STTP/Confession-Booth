// @booth/shared/constants — browser-safe SSOT (P1 #11).
// ATURAN: file ini TANPA node:* import agar bisa dipakai bundle browser web
// via '@booth/shared/constants'. Konstanta runtime + guard + util string murni.
// Kriptografi (node:crypto) dan zod tetap di index.ts / schemas.ts (node-only).

export const CONFESSION_MIN = 1;
export const CONFESSION_MAX = 500;
export const WHISPER_MIN = 1;
export const WHISPER_MAX = 300;
export const REPORT_DETAILS_MAX = 500;

/** Versi protokol anchoring on-chain (publisher mengirim nilai ini). */
export const PROTOCOL_VERSION = 1;

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

/** Badge metadata kanonis (server-awarded only — input client ditolak/diabaikan). */
export const BADGES = [
  {
    type: 'EMPATHETIC_LISTENER',
    label: 'Empathetic Listener',
    icon: 'heart-handshake',
    desc: 'Offer empathy and understanding reactions to fellow souls',
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  {
    type: 'MIDNIGHT_SOUL',
    label: 'Midnight Soul',
    icon: 'moon',
    desc: 'Pour your heart out in the silence of late night (00:00 - 04:00)',
    color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  },
  {
    type: 'CHAIN_WEAVER',
    label: 'Chain Weaver',
    icon: 'link',
    desc: 'Connect anonymous dialogues in confession threads',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  {
    type: 'STEALTH_CONFESSOR',
    label: 'Stealth Confessor',
    icon: 'shield-check',
    desc: 'Share untraceable truths with Zero-Knowledge cryptographic stealth',
    color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  },
] as const;

export type BadgeType = (typeof BADGES)[number]['type'];
export const BADGE_TYPES = new Set<string>(BADGES.map((b) => b.type));
export function isBadgeType(v: unknown): v is BadgeType {
  return typeof v === 'string' && BADGE_TYPES.has(v);
}

/** Hitung karakter Unicode (code point) — benar untuk emoji/ZWJ. */
export function countChars(s: string): number {
  return Array.from(s ?? '').length;
}

/** Normalisasi kanonis: NFC + collapse whitespace + trim. */
export function normalizeContent(s: string): string {
  return (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Normalisasi untuk deteksi duplikat & hash: lowercase + collapse + trim. */
export function normalizeForDedup(s: string): string {
  return normalizeContent(s).toLowerCase();
}
