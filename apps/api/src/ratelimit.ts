// Rate limiter fixed-window berbasis DB (SCHEMA §14 rate_limit_buckets).
// - subject mentah (IP/user) TIDAK disimpan — hanya sha256(subject).
// - Batas default dari API.md §11.
import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './db/schema.js';

export const LIMITS = {
  nonce: { limit: 10, windowMs: 10 * 60_000 },
  verify: { limit: 20, windowMs: 10 * 60_000 },
  refresh: { limit: 20, windowMs: 10 * 60_000 },
  logout: { limit: 30, windowMs: 10 * 60_000 },
  admin: { limit: 10, windowMs: 10 * 60_000 },
  confess: { limit: 3, windowMs: 3600_000 },
  whisper: { limit: 10, windowMs: 3600_000 },
  react: { limit: 60, windowMs: 3600_000 },
  report: { limit: 10, windowMs: 3600_000 },
} as const;

export type RateAction = keyof typeof LIMITS;

export function hashSubject(subject: string): string {
  return createHash('sha256').update(`booth-ratelimit:${subject}`, 'utf8').digest('hex');
}

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

/** Naikkan counter; ok=false bila melewati limit. Bersihkan window lama milik subject+action yang sama. */
export async function checkRateLimit(
  db: NodePgDatabase<typeof schema>,
  subject: string,
  action: RateAction,
  now = Date.now(),
): Promise<RateResult> {
  const { limit, windowMs } = LIMITS[action];
  const subjectHash = hashSubject(subject);
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  await db.execute(sql`
    DELETE FROM rate_limit_buckets
    WHERE subject_hash = ${subjectHash} AND action = ${action} AND window_start < ${windowStart.toISOString()}::timestamptz
  `);

  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_buckets (subject_hash, action, window_start, count)
    VALUES (${subjectHash}, ${action}, ${windowStart.toISOString()}::timestamptz, 1)
    ON CONFLICT (subject_hash, action, window_start)
    DO UPDATE SET count = rate_limit_buckets.count + 1
    RETURNING count
  `);
  // node-postgres mengembalikan QueryResult { rows } — bukan array langsung.
  const rows = (res as unknown as { rows: Array<{ count: number | string }> }).rows ?? [];
  const count = Number(rows[0]?.count ?? 1);
  if (count <= limit) return { ok: true, retryAfterSec: 0 };
  const retryAfterSec = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
  return { ok: false, retryAfterSec };
}
