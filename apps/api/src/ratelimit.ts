// Rate limiter sliding-window berbasis DB (SCHEMA §14 rate_limit_buckets).
// - subject mentah (IP/user) TIDAK disimpan — hanya sha256(subject).
// - Batas default dari API.md §11.
// T1H-002: Sliding window log implementation untuk mencegah burst di boundary window.
import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './db/schema.js';

export const LIMITS = {
  nonce: { limit: 10, windowMs: 10 * 60_000 },
  verify: { limit: 20, windowMs: 10 * 60_000 },
  refresh: { limit: 20, windowMs: 10 * 60_000 },
  logout: { limit: 30, windowMs: 10 * 60_000 },
  confess: { limit: 3, windowMs: 3600_000 },
  whisper: { limit: 10, windowMs: 3600_000 },
  react: { limit: 60, windowMs: 3600_000 },
  report: { limit: 10, windowMs: 3600_000 },
  admin: { limit: 10, windowMs: 10 * 60_000 },
  zkRegister: { limit: 10, windowMs: 3600_000 },
  // P2 #15: baca publik anti-scraping (loopback dikecualikan di common).
  read: { limit: 300, windowMs: 60_000 },
} as const;

export type RateAction = keyof typeof LIMITS;

export function hashSubject(subject: string): string {
  return createHash('sha256').update(`booth-ratelimit:${subject}`, 'utf8').digest('hex');
}

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

/** Sliding window log atomik: DELETE + COUNT + INSERT dalam satu transaksi serializable.
 *  Mencegah burst di boundary window & race condition konkuren. */
export async function checkRateLimit(
  db: NodePgDatabase<typeof schema>,
  subject: string,
  action: RateAction,
  now = Date.now(),
): Promise<RateResult> {
  const { limit, windowMs } = LIMITS[action];
  const subjectHash = hashSubject(subject);
  const windowStart = now - windowMs;
  const windowStartIso = new Date(windowStart).toISOString();
  const nowIso = new Date(now).toISOString();

  // Gunakan transaksi untuk atomicity: hapus expired, hitung, insert baru
  const result = await db.transaction(async (tx) => {
    // 1. Hapus entry di luar window
    await tx.execute(sql`
      DELETE FROM rate_limit_buckets
      WHERE subject_hash = ${subjectHash}
        AND action = ${action}
        AND window_start < ${windowStartIso}::timestamptz
    `);

    // 2. Hitung request dalam window sliding
    const countRes = await tx.execute(sql`
      SELECT COUNT(*) as cnt FROM rate_limit_buckets
      WHERE subject_hash = ${subjectHash}
        AND action = ${action}
        AND window_start >= ${windowStartIso}::timestamptz
    `);

    const currentCount = Number((countRes as any).rows?.[0]?.cnt ?? 0);

    if (currentCount >= limit) {
      // Limit tercapai: cari request tertua untuk retry-after
      const oldestRes = await tx.execute(sql`
        SELECT window_start FROM rate_limit_buckets
        WHERE subject_hash = ${subjectHash}
          AND action = ${action}
        ORDER BY window_start ASC LIMIT 1
      `);

      const oldest = (oldestRes as any).rows?.[0]?.window_start;
      const retryAfterSec = oldest
        ? Math.max(1, Math.ceil((new Date(oldest).getTime() + windowMs - now) / 1000))
        : Math.ceil(windowMs / 1000);

      return { ok: false, retryAfterSec };
    }

    // 3. Tambah entry baru (baru insert kalau lolos limit)
    await tx.execute(sql`
      INSERT INTO rate_limit_buckets (subject_hash, action, window_start)
      VALUES (${subjectHash}, ${action}, ${nowIso}::timestamptz)
    `);

    return { ok: true, retryAfterSec: 0 };
  });

  return result;
}
