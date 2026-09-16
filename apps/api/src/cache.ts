// Cache feed T1-030 (memori 60s) + T1H-002 Redis opsional.
// Tanpa REDIS_URL → memori proses (cukup 1 replika MVP).
// Dengan REDIS_URL → Redis (bagi antar replika/worker), fallback memori bila putus.
// Key: query string sort+category+limit+cursor+q+slot. Tanpa konten privat di key.
// AUDIT SEC-005: Redis reconnect setelah recovery (bukan permanent down).
// AUDIT PERF-006: LRU-style eviction (hapus 25% tertua, bukan clear semua).
import { createClient, type RedisClientType } from 'redis';

const store = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 60_000;
const TTL_SEC = 60;
const MAX_CACHE_SIZE = 500;

let redis: RedisClientType | null = null;
let redisDown = false;
let redisDownSince = 0;
const REDIS_RETRY_INTERVAL_MS = 30_000; // retry setiap 30 detik

async function redisClient(): Promise<RedisClientType | null> {
  const url = (process.env.REDIS_URL ?? '').trim();
  if (!url) return null;

  // AUDIT SEC-005: jika Redis down, coba reconnect setelah interval
  if (redisDown) {
    if (Date.now() - redisDownSince < REDIS_RETRY_INTERVAL_MS) return null;
    // Reset dan coba lagi
    redisDown = false;
    redis = null;
  }

  if (redis) return redis;
  try {
    const client = createClient({ url, socket: { connectTimeout: 2000 } });
    client.on('error', () => {
      redisDown = true;
      redisDownSince = Date.now();
      redis = null;
    });
    await client.connect();
    redis = client as RedisClientType;
    return redis;
  } catch {
    redisDown = true;
    redisDownSince = Date.now();
    return null;
  }
}

function memGet(key: string): unknown | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  // LRU: update access time
  e.at = Date.now();
  return e.body;
}

// AUDIT PERF-006: LRU eviction — hapus 25% entry terlama, bukan clear semua.
function evictOldest(): void {
  const toEvict = Math.floor(MAX_CACHE_SIZE * 0.25);
  const entries = [...store.entries()].sort((a, b) => a[1].at - b[1].at);
  for (let i = 0; i < toEvict && i < entries.length; i++) {
    store.delete(entries[i][0]);
  }
}

function memSet(key: string, body: unknown): void {
  if (store.size >= MAX_CACHE_SIZE) evictOldest();
  store.set(key, { at: Date.now(), body });
}

export async function feedCacheGet(key: string): Promise<unknown | null> {
  const c = await redisClient();
  if (c) {
    try {
      const raw = await c.get(`booth:feed:${key}`);
      if (raw) return JSON.parse(raw) as unknown;
    } catch {
      // jatuh ke memori
    }
  }
  return memGet(key);
}

export async function feedCacheSet(key: string, body: unknown): Promise<void> {
  memSet(key, body);
  const c = await redisClient();
  if (c) {
    try {
      await c.set(`booth:feed:${key}`, JSON.stringify(body), { EX: TTL_SEC });
    } catch {
      // abaikan — memori tetap jalan
    }
  }
}

/** Dipanggil setiap aksi moderasi HIDE/REMOVE/RESTORE/BAN + konten kritis QUARANTINED. */
export async function feedCacheInvalidate(): Promise<void> {
  store.clear();
  const c = await redisClient();
  if (c) {
    try {
      for await (const k of c.scanIterator({ MATCH: 'booth:feed:*', COUNT: 200 })) {
        await c.del(k);
      }
    } catch {
      // abaikan
    }
  }
}
