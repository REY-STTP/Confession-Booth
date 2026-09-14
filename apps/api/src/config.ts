// Konfigurasi server — dotenv dimuat sekali di sini; diimpor pertama oleh server.ts.
// Server-only: tidak ada nilai dari sini yang boleh di-render ke publik.
import dotenv from 'dotenv';

dotenv.config();

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
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  accessTtlMs: 60 * 60 * 1000, // 1 jam
  refreshTtlMs: 30 * 24 * 3600 * 1000, // 30 hari
  nonceTtlMs: 5 * 60 * 1000, // 5 menit
};

export { required };
