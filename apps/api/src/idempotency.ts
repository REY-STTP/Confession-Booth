// Idempotency DB T1-005 (API.md §12): retry aman untuk POST publikasi.
// - Kunci: (key, user_id), respons final disimpan 24 jam.
// - dipakai: POST /confessions, /whispers, /reactions (wiring penuh di 1B/T1-010+).
// - T1-027: kunci dinormalisasi via sha256 bila gabungan scope+key > 100 char,
//   agar tidak melebihi varchar(128) (uuid 36 + ':' + 128 = 165).
import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt } from 'drizzle-orm';
import * as schema from './db/schema.js';

export const IDEMPOTENCY_TTL_MS = 24 * 3600_000;

/** Normalisasi kunci idempotency agar selalu ≤128 char (kolom DB). */
export function normalizeIdemKey(key: string): string {
  if (key.length <= 100) return key;
  return `h_${createHash('sha256').update(key, 'utf8').digest('hex')}`;
}

export interface IdemResult<T> {
  replay: boolean;
  statusCode: number;
  body: T;
}

/**
 * Jalankan `fn` sekali per (key, user). Panggilan ulang dengan key sama
 * mengembalikan respons tersimpan — tidak ada efek ganda.
 * Balapan konkurens diselesaikan oleh constraint unik (pihak kalah membaca milik pemenang).
 */
export async function withIdempotency<T>(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  key: string,
  fn: () => Promise<{ statusCode: number; body: T }>,
  now = Date.now(),
): Promise<IdemResult<T>> {
  const normKey = normalizeIdemKey(key);
  const existing = await db
    .select()
    .from(schema.idempotencyKeys)
    .where(
      and(
        eq(schema.idempotencyKeys.key, normKey),
        eq(schema.idempotencyKeys.userId, userId),
        gt(schema.idempotencyKeys.expiresAt, new Date(now)),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { replay: true, statusCode: existing[0].statusCode, body: existing[0].response as T };
  }

  const out = await fn();
  try {
    await db.insert(schema.idempotencyKeys).values({
      key: normKey,
      userId,
      statusCode: out.statusCode,
      response: out.body as Record<string, unknown>, // SIMPAN HANYA body, bukan wrapper
      expiresAt: new Date(now + IDEMPOTENCY_TTL_MS),
    });
    // Return body langsung (bukan wrapper) agar konsisten dengan replay
    return { replay: false, statusCode: out.statusCode, body: out.body };
  } catch (e) {
    // P1 #10: hanya 23505 (unique violation) yang berarti kalah balapan.
    // Error lain (FK, koneksi, code tak dikenal) wajib dilempar asli.
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code !== '23505') throw e;
    // Kalah balapan: baca milik pemenang.
    const winner = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(
        and(eq(schema.idempotencyKeys.key, normKey), eq(schema.idempotencyKeys.userId, userId)),
      )
      .limit(1);
    if (winner[0])
      return { replay: true, statusCode: winner[0].statusCode, body: winner[0].response as T };
    throw e instanceof Error ? e : new Error('IDEMPOTENCY_RACE_UNRESOLVED');
  }
}
