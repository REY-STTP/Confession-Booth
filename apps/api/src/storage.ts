// StorageAdapter T1-022 + IPFS nyata T1H-001.
// - DbInlineAdapter: MVP (konten di Postgres, CID null).
// - IpfsHttpAdapter: Kubo/IPFS HTTP RPC (`STORAGE_ENDPOINT`, mis. http://127.0.0.1:5001).
//   Auth opsional Basic (STORAGE_API_KEY/SECRET). Tanpa endpoint → jangan dipakai.
// - FallbackStorageAdapter: primer → sekunder bila primer gagal.
// - verifyStoredContent: integrity check sha256(body) == contentHash (kanonis dedup).
// Handler hanya memakai put(); pilihan adapter di-resolve saat boot (server.ts).

import { createHash } from 'node:crypto';
import { normalizeForDedup } from '@booth/shared';

export interface StoredRef {
  provider: string;
  cid: string | null;
}

export interface StorageAdapter {
  readonly name: string;
  put(contentHash: string, body: string): Promise<StoredRef>;
}

export class DbInlineAdapter implements StorageAdapter {
  readonly name = 'db:inline';
  async put(_contentHash: string, _body: string): Promise<StoredRef> {
    return { provider: 'db:inline', cid: null };
  }
}

/** Kubo RPC: POST {endpoint}/api/v0/add → [{Hash}]. Body dikirim multipart. */
export class IpfsHttpAdapter implements StorageAdapter {
  readonly name = 'ipfs:http';
  constructor(
    private readonly endpoint: string = process.env.STORAGE_ENDPOINT ?? '',
    private readonly apiKey: string = process.env.STORAGE_API_KEY ?? '',
    private readonly apiSecret: string = process.env.STORAGE_API_SECRET ?? '',
  ) {
    if (!this.endpoint) throw new Error('[storage] STORAGE_ENDPOINT belum di-set');
  }

  private headers(): Record<string, string> {
    if (this.apiKey) {
      const cred = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
      return { Authorization: `Basic ${cred}` };
    }
    return {};
  }

  async put(contentHash: string, body: string): Promise<StoredRef> {
    // Integrity sebelum upload: contentHash yang dipassing route adalah canonicalHash
    // = sha256(normalizeForDedup) — samakan di sini agar konsisten dengan on-chain.
    const actual = createHash('sha256').update(normalizeForDedup(body), 'utf8').digest('hex');
    if (actual !== contentHash) throw new Error('[storage] content hash mismatch (tolak upload)');
    const form = new FormData();
    form.append('file', new Blob([body], { type: 'text/plain' }));
    const res = await fetch(`${this.endpoint.replace(/\/$/, '')}/api/v0/add?pin=true`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
    });
    if (!res.ok) throw new Error(`[storage] ipfs add failed: ${res.status}`);
    const text = await res.text();
    // Kubo streaming JSON: ambil baris terakhir berisi Hash.
    const lines = text.trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as { Hash?: string };
    if (!last.Hash) throw new Error('[storage] ipfs add tanpa Hash');
    return { provider: 'ipfs:http', cid: last.Hash };
  }

  async cat(cid: string): Promise<string> {
    const res = await fetch(
      `${this.endpoint.replace(/\/$/, '')}/api/v0/cat?arg=${encodeURIComponent(cid)}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`[storage] ipfs cat failed: ${res.status}`);
    return res.text();
  }
}

export class FallbackStorageAdapter implements StorageAdapter {
  readonly name: string;
  constructor(
    private readonly primary: StorageAdapter,
    private readonly secondary: StorageAdapter,
  ) {
    this.name = `fallback:${primary.name}+${secondary.name}`;
  }
  async put(contentHash: string, body: string): Promise<StoredRef> {
    try {
      return await this.primary.put(contentHash, body);
    } catch {
      return this.secondary.put(contentHash, body);
    }
  }
}

/** Integrity check: sha256(normalizeForDedup(body)) harus == contentHash on-chain/DB. */
export function verifyStoredContent(contentHash: string, body: string): boolean {
  const actual = createHash('sha256').update(normalizeForDedup(body), 'utf8').digest('hex');
  return actual === contentHash;
}

/** Adapter default runtime. Uji T1-022 membuktikan ganti adapter tidak ubah bentuk data. */
export const defaultStorage: StorageAdapter = new DbInlineAdapter();

let current: StorageAdapter = defaultStorage;

/** Ganti adapter aktif (IPFS di Fase 1.5; fake di test). */
export function setStorage(adapter: StorageAdapter): void {
  current = adapter;
}

export function getStorage(): StorageAdapter {
  return current;
}

/** Resolve adapter dari env saat boot (T1H-001). Tanpa STORAGE_ENDPOINT → db:inline. */
export function storageFromEnv(): StorageAdapter {
  const endpoint = (process.env.STORAGE_ENDPOINT ?? '').trim();
  if (!endpoint) return new DbInlineAdapter();
  const primary = new IpfsHttpAdapter();
  // Multi-provider fallback: sekunder inline agar publish tetap jalan saat IPFS down.
  return new FallbackStorageAdapter(primary, new DbInlineAdapter());
}
