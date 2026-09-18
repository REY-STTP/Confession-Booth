import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

function required(name: string): string {
  const v = process.env[name];
  // T1-023/T1-040: di production wajib fatal, di dev boleh warning.
  if (!v) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[booth-api] ${name} wajib di-set di production`);
    }
    console.warn(`[booth-api] ${name} belum di-set (pakai default dev)`);
  }
  return v ?? '';
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('[booth-api] SESSION_SECRET wajib di-set di production');
}
if (isProd && !process.env.DATABASE_URL) {
  throw new Error('[booth-api] DATABASE_URL wajib di-set di production');
}

// P1 #6: SESSION_SECRET fail-closed — pendek (<32) fatal di semua env,
// karena dipakai untuk sesi + HMAC PoW. Default dev 33 char tetap lolos.
function assertSessionSecret(s: string): string {
  if (s.length < 32) {
    if (isProd) throw new Error('[booth-api] SESSION_SECRET min 32 chars di production');
    console.warn('[booth-api] SESSION_SECRET < 32 chars — hanya untuk dev/test lokal');
  }
  return s;
}

// P1 #6: trustProxy eksplisit — default false (IP spoof via X-Forwarded-For
// mematikan rate-limit). Set TRUST_PROXY=true hanya bila langsung di belakang
// LB/reverse-proxy tepercaya.
function parseTrustProxy(): boolean {
  const v = (process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  return v === 'true' || v === '1';
}

function parseCorsOrigin(): string[] {
  const list = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',');
  // P1 #6: '*' + credentials adalah kombinasi terlarang di production.
  if (isProd && list.some((s) => s.trim() === '*')) {
    throw new Error('[booth-api] CORS_ORIGIN=* terlarang dengan credentials di production');
  }
  return list;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  sessionSecret: assertSessionSecret(
    process.env.SESSION_SECRET ?? 'dev-only-change-me-min-32-chars',
  ),
  appDomain: process.env.APP_DOMAIN ?? 'booth.local',
  appName: 'Confession Booth',
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111),
  // Satu sumber kanonis: NEXT_PUBLIC_CONTRACT_ADDRESS (CONTRACT_ADDRESS lama dihapus).
  contractAddress: (() => {
    const raw = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    return raw && !raw.startsWith('0x0000') ? raw : '0x015a0018bCefd2604833D9f7B9f5D439aaCaaAB0';
  })(),
  corsOrigin: parseCorsOrigin(),
  trustProxy: parseTrustProxy(),
  accessTtlMs: 60 * 60 * 1000, // 1 jam
  refreshTtlMs: 30 * 24 * 3600 * 1000, // 30 hari
  nonceTtlMs: 5 * 60 * 1000, // 5 menit
  // Publisher gas/nonce management (T1H-002)
  publisherMaxFeePerGas: process.env.PUBLISHER_MAX_FEE_PER_GAS
    ? BigInt(process.env.PUBLISHER_MAX_FEE_PER_GAS)
    : undefined,
  publisherMaxPriorityFeePerGas: process.env.PUBLISHER_MAX_PRIORITY_FEE_PER_GAS
    ? BigInt(process.env.PUBLISHER_MAX_PRIORITY_FEE_PER_GAS)
    : undefined,
  publisherUseNonceManager: process.env.PUBLISHER_USE_NONCE_MANAGER === 'true',
};

export { required };
