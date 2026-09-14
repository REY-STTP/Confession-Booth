// Cache feed T1-030 (memori 60s) + T1H-002 Redis opsional.
// Tanpa REDIS_URL → memori proses (cukup 1 replika MVP).
// Dengan REDIS_URL → Redis (bagi antar replika/worker), fallback memori bila putus.
// Key: query string sort+category+limit+cursor+q+slot. Tanpa konten privat di key.
import { createClient, type RedisClientType } from 'redis';

const store = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 60_000;
const TTL_SEC = 60;

let redis: RedisClientType | null = null;
let redisDown = false;

async function redisClient(): Promise<RedisClientType | null> {
  const url = (process.env.REDIS_URL ?? '').trim();
  if (!url || redisDown) return null;
  if (redis) return redis;
  try {
    const client = createClient({ url, socket: { connectTimeout: 2000 } });
    client.on('error', () => {
      redisDown = true;
    });
    await client.connect();
    redis = client as RedisClientType;
    return redis;
  } catch {
    redisDown = true;
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
  return e.body;
}

function memSet(key: string, body: unknown): void {
  if (store.size > 500) store.clear();
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
