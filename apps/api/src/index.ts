import dotenv from 'dotenv';

dotenv.config();

import { buildApp } from './server.js';
import { setStorage, storageFromEnv } from './storage.js';

const port = Number(process.env.PORT ?? 4000);

const missing: string[] = [];
for (const k of ['DATABASE_URL', 'SESSION_SECRET']) {
  if (!process.env[k]) missing.push(k);
}
if (missing.length > 0) {
  // Fase 0: peringatan saja agar `npm run dev` tetap jalan tanpa DB.
  // Fase 1 (T1-040): ubah menjadi fatal saat boot.
  console.warn(`[booth-api] missing env (warning-only in Fase 0): ${missing.join(', ')}`);
}

const app = await buildApp();
// T1H-001: resolve adapter storage dari env (IPFS bila STORAGE_ENDPOINT di-set).
try {
  const adapter = storageFromEnv();
  setStorage(adapter);
  console.log(`[booth-api] storage: ${adapter.name}`);
} catch (e) {
  console.warn(`[booth-api] storage fallback db:inline (${e instanceof Error ? e.message : e})`);
}
await app.listen({ port, host: '0.0.0.0' });
console.log(`[booth-api] listening on :${port} (mock mode)`);
