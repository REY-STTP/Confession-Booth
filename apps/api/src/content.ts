// Helper konten 1B: ID publik, proyeksi publik, resolusi target.
// Proyeksi publik WAJIB lolos assertPublicSafe (SCHEMA §17) — tanpa wallet,
// user ID internal, IP, session, atau catatan moderasi.

import { randomBytes, randomInt } from 'node:crypto';
import { keccak256, toHex } from 'viem';
import { canonicalHash as sharedCanonicalHash, makeAnonymousName } from '@booth/shared';

export function newPublicId(prefix: 'c' | 'w'): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

export function newDisplaySeed(): number {
  return randomInt(1000, 10000);
}

export function displayName(seed: number): string {
  return makeAnonymousName(seed);
}

/** ID on-chain deterministik (bytes32 hex) dari publicId — tanpa info identitas. */
export function onchainId(publicId: string): string {
  return keccak256(toHex(publicId));
}

/** Hash kanonis konten — delegasi ke SSOT shared (P1 #11 S2).
 *  NFC + lowercase + collapse whitespace (didokumentasikan).
 *  Dipakai untuk contentHash on-chain DAN deteksi duplikat — verifier menghitung
 *  ulang dengan aturan yang sama: sha256(normalizeForDedup(body)). */
export function canonicalHash(body: string): string {
  return sharedCanonicalHash(body);
}

export interface PublicConfession {
  id: string;
  publicId: string;
  author: { displayName: string };
  category: string;
  content: string;
  createdAt: string;
  reactions: Record<string, number>;
  whisperCount: number;
  status: string;
  proofType?: string;
  roomSlug?: string;
  badgeType?: string;
  /** P1 #13: tipe reaksi milik pembaca (hanya bila terautentikasi, UPPER enum). */
  reactedByMe?: string[];
}

export interface ConfessionRow {
  public_id: string;
  body_text: string;
  display_seed: number;
  status: string;
  created_at: Date;
  category: string;
  proof_type?: string | null;
  room_slug?: string | null;
  badge_type?: string | null;
}

export function projectConfession(
  row: ConfessionRow,
  reactions: Record<string, number>,
  whisperCount: number,
  reactedByMe?: string[],
): PublicConfession {
  return {
    id: row.public_id,
    publicId: row.public_id,
    author: { displayName: displayName(row.display_seed) },
    category: row.category,
    content: row.body_text,
    createdAt: new Date(row.created_at).toISOString(),
    reactions: {
      understand: reactions.UNDERSTAND ?? 0,
      love: reactions.LOVE ?? 0,
      sad: reactions.SAD ?? 0,
      wild: reactions.WILD ?? 0,
      funny: reactions.FUNNY ?? 0,
    },
    whisperCount,
    status: row.status.toLowerCase(),
    proofType: row.proof_type ?? 'SESSION',
    roomSlug: row.room_slug ?? undefined,
    badgeType: row.badge_type ?? undefined,
    // P1 #13: hanya diisi bila pemanggil terautentikasi; anon → undefined (hemat + privat).
    ...(reactedByMe && reactedByMe.length > 0 ? { reactedByMe } : {}),
  };
}

export function snippet(body: string, n = 140): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}
