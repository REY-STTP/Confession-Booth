// Helper konten 1B: ID publik, proyeksi publik, resolusi target.
// Proyeksi publik WAJIB lolos assertPublicSafe (SCHEMA §17) — tanpa wallet,
// user ID internal, IP, session, atau catatan moderasi.

import { randomBytes, randomInt } from 'node:crypto';
import { keccak256, toHex } from 'viem';
import { createHash } from 'node:crypto';
import { makeAnonymousName, normalizeForDedup } from '@booth/shared';

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

/** Hash kanonis konten: NFC + lowercase + collapse whitespace (didokumentasikan).
 *  Dipakai untuk contentHash on-chain DAN deteksi duplikat — verifier menghitung
 *  ulang dengan aturan yang sama: sha256(normalizeForDedup(body)). */
export function canonicalHash(body: string): string {
  return createHash('sha256').update(normalizeForDedup(body), 'utf8').digest('hex');
}

export interface PublicConfession {
  id: string;
  author: { displayName: string };
  category: string;
  content: string;
  createdAt: string;
  reactions: Record<string, number>;
  whisperCount: number;
  status: string;
}

export interface ConfessionRow {
  public_id: string;
  body_text: string;
  display_seed: number;
  status: string;
  created_at: Date;
  category: string;
}

export function projectConfession(
  row: ConfessionRow,
  reactions: Record<string, number>,
  whisperCount: number,
): PublicConfession {
  return {
    id: row.public_id,
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
  };
}

export function snippet(body: string, n = 140): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}
