// Anti-spam v2 T1H-005: Proof-of-Work eskalasi (tanpa provider eksternal).
// Saat abuse skor flag (>=50), POST tulis menjawab 429 POW_REQUIRED + challenge.
// Client menyelesaikan sha256(salt:nonce) dengan `difficulty` bit nol di depan,
// lalu retry dengan header `x-pow-solution: <token>:<nonceN>`.
// Token stateless: salt.exp.HMAC(SESSION_SECRET) agar tidak bisa dipalsukan.
// CAPTCHA provider (mis. Turnstile) tetap didukung via interface bila kunci di-set.
import { createHash, createHmac, randomBytes } from 'node:crypto';

export interface PowChallenge {
  token: string;
  difficulty: number;
  expiresAt: string;
}

function secret(): string {
  return process.env.SESSION_SECRET ?? 'dev-only-change-me-min-32-chars';
}

export function powDifficulty(): number {
  const n = Number(process.env.POW_DIFFICULTY ?? 14);
  return Number.isInteger(n) && n >= 8 && n <= 24 ? n : 14;
}

export function issuePowChallenge(now = Date.now(), ttlMs = 10 * 60_000): PowChallenge {
  const salt = randomBytes(16).toString('hex');
  const difficulty = powDifficulty();
  const exp = now + ttlMs;
  const mac = createHmac('sha256', secret()).update(`${salt}.${difficulty}.${exp}`, 'utf8').digest('hex');
  return { token: `${salt}.${difficulty}.${exp}.${mac}`, difficulty, expiresAt: new Date(exp).toISOString() };
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

export function verifyPowSolution(solution: string, now = Date.now()): boolean {
  const [token, nonceN] = solution.split(':');
  if (!token || nonceN === undefined || nonceN.length > 64) return false;
  const [salt, diffS, expS, mac] = token.split('.');
  const difficulty = Number(diffS);
  const exp = Number(expS);
  if (!salt || !Number.isInteger(difficulty) || !Number.isFinite(exp)) return false;
  if (exp <= now) return false;
  const expectMac = createHmac('sha256', secret()).update(`${salt}.${difficulty}.${exp}`, 'utf8').digest('hex');
  if (mac !== expectMac) return false;
  const h = createHash('sha256').update(`${salt}:${nonceN}`, 'utf8').digest('hex');
  return hashMeetsDifficulty(h, difficulty);
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
