// @booth/shared/schemas — Zod SSOT untuk payload API (P1 #11).
// Dipakai @booth/api (runtime node). Browser-safe (hanya zod + constants),
// tapi web memakai subpath ini seperlunya (lihat '@booth/shared/constants').
import { z } from 'zod';
import {
  BADGES,
  CONFESSION_MAX,
  REACTIONS,
  WHISPER_MAX,
  type BadgeType,
  type ReactionType,
} from './constants.js';

export const HEX64 = z.string().regex(/^[0-9a-fA-F]{64}$/);

/** Tipe badge server-awarded — input client di luar daftar ini ditolak. */
export const badgeTypeSchema = z.enum(BADGES.map((b) => b.type) as [BadgeType, ...BadgeType[]]);

export const reactionTypeSchema = z.enum(
  REACTIONS.map((r) => r.type) as [ReactionType, ...ReactionType[]],
);

/** Bukti anonim ZK (format ketat P0 #1 — stub mock, bukan verifikasi kripto). */
export const zkProofSchema = z.object({
  merkleRoot: HEX64,
  nullifierHash: HEX64,
  epoch: z.number().int().min(0).max(999999999),
  scope: z.literal('confess'),
  signal: HEX64,
  proof: z.string().regex(/^[0-9a-fA-F]{64,256}$/),
});
export type ZkProof = z.infer<typeof zkProofSchema>;

export const confessSchema = z.object({
  // category tetap string longgar di sini — route memetakan ke INVALID_CATEGORY
  // via isCategorySlug (jangan jadi enum agar error-code tak berubah).
  category: z.string().min(1).max(64),
  content: z.string().min(1).max(CONFESSION_MAX),
  roomSlug: z.string().min(1).max(64).optional(),
  badgeType: badgeTypeSchema.optional(),
  zkProof: zkProofSchema.optional(),
});
export type ConfessPayload = z.infer<typeof confessSchema>;

export const whisperSchema = z.object({
  content: z.string().min(1).max(WHISPER_MAX),
  parentWhisperId: z.string().min(3).max(64).optional(),
  badgeType: badgeTypeSchema.optional(),
});
export type WhisperPayload = z.infer<typeof whisperSchema>;

export const reactSchema = z.object({ type: reactionTypeSchema });
export type ReactPayload = z.infer<typeof reactSchema>;

export const feedQuerySchema = z.object({
  sort: z.enum(['new', 'trending', 'relatable']).default('new'),
  category: z.string().min(1).max(64).optional(),
  room: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).optional(),
  q: z.string().min(1).max(200).optional(),
  slot: z.enum(['any', 'midnight']).default('any'),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const commitmentSchema = z.object({
  commitment: HEX64,
});
export type CommitmentPayload = z.infer<typeof commitmentSchema>;
