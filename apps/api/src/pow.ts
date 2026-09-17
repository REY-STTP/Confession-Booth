// Anti-spam v2 T1H-005: Proof-of-Work eskalasi (tanpa provider eksternal).
// Saat abuse skor flag (>=50), POST tulis menjawab 429 POW_REQUIRED + challenge.
// Client menyelesaikan sha256(salt:nonce) dengan `difficulty` bit nol di depan,
// lalu retry dengan header `x-pow-solution: <token>:<nonceN>`.
// Token stateless: salt.difficulty.exp.userHash.HMAC(config.sessionSecret).
//
// P0 hardening (REPORTS.md P0 #4):
// - Secret dari config.sessionSecret (bukan process.env langsung); prod + <32 char → fatal.
// - Compare MAC dengan timingSafeEqual (anti timing leak).
// - Challenge diikat ke subjek (`user:<id>` / `ip:<addr>`) — solusi tidak bisa
//   replay lintas user/IP. Format token tetap diawali salt agar solver lama
//   (`token.split('.')[0]`) tetap kompatibel.
// - Single-use: solusi valid dicatat di pow_solutions (PK solution_hash);
//   konflik = replay → ditolak. Challenge lama (4 segmen, tanpa userHash) ditolak.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema.js';
import { config } from './config.js';

export interface PowChallenge {
  token: string;
  difficulty: number;
  expiresAt: string;
}

function secret(): string {
  const s = config.sessionSecret;
  if (process.env.NODE_ENV === 'production' && s.length < 32) {
    throw new Error('[booth-api] SESSION_SECRET too short for PoW HMAC (min 32 chars)');
  }
  return s;
}

export function powDifficulty(): number {
  const n = Number(process.env.POW_DIFFICULTY ?? 14);
  return Number.isInteger(n) && n >= 8 && n <= 24 ? n : 14;
}

/** Hash pengikat subjek — solusi PoW hanya valid untuk subjek penerbit. */
export function powSubjectHash(subject: string): string {
  return createHash('sha256').update(`booth-pow:${subject}`, 'utf8').digest('hex');
}

export function issuePowChallenge(
  subject: string,
  now = Date.now(),
  ttlMs = 10 * 60_000,
): PowChallenge {
  const salt = randomBytes(16).toString('hex');
  const difficulty = powDifficulty();
  const exp = now + ttlMs;
  const userHash = powSubjectHash(subject);
  const mac = createHmac('sha256', secret())
    .update(`${salt}.${difficulty}.${exp}.${userHash}`, 'utf8')
    .digest('hex');
  return {
    token: `${salt}.${difficulty}.${exp}.${userHash}.${mac}`,
    difficulty,
    expiresAt: new Date(exp).toISOString(),
  };
}

function hashMeetsDifficulty(hex: string, difficulty: number): boolean {
  const bytes = Buffer.from(hex, 'hex');
  let bits = 0;
  for (const b of bytes) {
    for (let i = 7; i >= 0 && bits < difficulty; i--) {
      if ((b >> i) & 1) return false;
      bits += 1;
    }
    if (bits >= difficulty) return true;
  }
  return bits >= difficulty;
}

function macEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Verifikasi solusi PoW untuk subjek tertentu + klaim single-use (replay → false).
 *  DB error selain konflik propagasi sebagai exception (fail-closed terlihat, bukan
 *  disamarkan jadi POW_REQUIRED). */
export async function verifyPowSolution(
  db: NodePgDatabase<typeof schema>,
  solution: string,
  subject: string,
  now = Date.now(),
): Promise<boolean> {
  const sep = solution.lastIndexOf(':');
  if (sep <= 0) return false;
  const token = solution.slice(0, sep);
  const nonceN = solution.slice(sep + 1);
  if (!nonceN || nonceN.length > 64) return false;
  const parts = token.split('.');
  if (parts.length !== 5) return false;
  const [salt, diffS, expS, userHash, mac] = parts;
  const difficulty = Number(diffS);
  const exp = Number(expS);
  if (!salt || !Number.isInteger(difficulty) || !Number.isFinite(exp)) return false;
  if (exp <= now) return false;
  if (userHash !== powSubjectHash(subject)) return false;
  const expectMac = createHmac('sha256', secret())
    .update(`${salt}.${difficulty}.${exp}.${userHash}`, 'utf8')
    .digest('hex');
  if (!macEqual(mac, expectMac)) return false;
  const h = createHash('sha256').update(`${salt}:${nonceN}`, 'utf8').digest('hex');
  if (!hashMeetsDifficulty(h, difficulty)) return false;
  const key = createHash('sha256')
    .update(`booth-pow-solution:${token}:${nonceN}`, 'utf8')
    .digest('hex');
  const ins = await db
    .insert(schema.powSolutions)
    .values({ solutionHash: key, expiresAt: new Date(exp) })
    .onConflictDoNothing()
    .returning({ solutionHash: schema.powSolutions.solutionHash });
  return ins.length > 0;
}

/** Solver client-side (dipakai web composer + test). */
export function solvePow(salt: string, difficulty: number, maxTries = 2_000_000): string | null {
  for (let n = 0; n < maxTries; n++) {
    const h = createHash('sha256').update(`${salt}:${n}`, 'utf8').digest('hex');
    if (hashMeetsDifficulty(h, difficulty)) return String(n);
  }
  return null;
}

/** CAPTCHA provider opsional (stub jujur: tanpa kunci → disabled, pakai PoW). */
export async function verifyCaptcha(_token: string): Promise<boolean> {
  if (!process.env.CAPTCHA_SECRET) return false;
  // Integrasi Turnstile/hCaptcha mengikuti bila CAPTCHA_SECRET di-set (T1H-005 lanjutan).
  return false;
}
