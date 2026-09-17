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

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-change-me-min-32-chars',
  appDomain: process.env.APP_DOMAIN ?? 'booth.local',
  appName: 'Confession Booth',
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111),
  // Satu sumber kanonis: NEXT_PUBLIC_CONTRACT_ADDRESS (CONTRACT_ADDRESS lama dihapus).
  contractAddress: (() => {
    const raw = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    return raw && !raw.startsWith('0x0000') ? raw : '0xa8302048773DD213B9D311c2abda199B14339188';
  })(),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
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
