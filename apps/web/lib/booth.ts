// Client data layer Fase 0: coba API nyata, fallback ke mock lokal bila API mati.
// Tidak ada wallet/secret yang disimpan di sini.
// T1-025: base URL dari NEXT_PUBLIC_API_URL (Vercel prod), fallback localhost hanya dev.

export interface FeedItem {
  id: string;
  publicId: string;
  author: { displayName: string };
  category: string;
  content: string;
  createdAt: string;
  reactions: Record<string, number>;
  whisperCount: number;
  proofType?: string;
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);
const API = API_URL;

export type FeedError = { message: string; offline: boolean };

let lastFeedError: FeedError | null = null;
export function getLastFeedError(): FeedError | null {
  return lastFeedError;
}

export const CATEGORIES = [
  'love',
  'heartbreak',
  'secret',
  'life',
  'school',
  'work',
  'family',
  'funny',
  'sad',
  'deep',
  'midnight',
];

const FALLBACK: FeedItem[] = [
  {
    id: 'c1',
    publicId: 'mock-1',
    author: { displayName: 'Anonymous #4821' },
    category: 'heartbreak',
    content: 'Sudah tiga tahun tapi tiap dengar lagu itu aku masih menepi sebentar.',
    createdAt: new Date().toISOString(),
    reactions: { understand: 128, love: 31, sad: 72 },
    whisperCount: 21,
  },
  {
    id: 'c2',
    publicId: 'mock-2',
    author: { displayName: 'Anonymous #1173' },
    category: 'love',
    content: 'Aku bilang tidak apa-apa waktu dia pergi. Ternyata aku hanya belum selesai sayang.',
    createdAt: new Date().toISOString(),
    reactions: { understand: 40, love: 90, sad: 12 },
    whisperCount: 8,
  },
  {
    id: 'c3',
    publicId: 'mock-3',
    author: { displayName: 'Anonymous #9021' },
    category: 'midnight',
    content: 'Jam 2 pagi dan aku masih memikirkan percakapan 4 tahun lalu.',
    createdAt: new Date().toISOString(),
    reactions: { understand: 77, love: 5, sad: 30 },
    whisperCount: 15,
  },
];

export function countChars(s: string): number {
  return Array.from(s).length;
}

export async function getFeed(
  params: { sort?: string; category?: string; q?: string; slot?: string } = {},
): Promise<FeedItem[]> {
  const qs = new URLSearchParams({ sort: params.sort ?? 'new', limit: '20' });
  if (params.category) qs.set('category', params.category);
  if (params.q) qs.set('q', params.q);
  if (params.slot) qs.set('slot', params.slot);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API}/api/feed?${qs.toString()}`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`feed failed: ${res.status}`);
    const body = await res.json();
    lastFeedError = null;
    return body.items as FeedItem[];
  } catch (e) {
    // T1-026: jangan silent — tandai offline agar UI bisa tampilkan error jujur.
    lastFeedError = {
      message: e instanceof Error ? e.message : 'network error',
      offline: true,
    };
    let items = [...FALLBACK];
    if (params.category) items = items.filter((i) => i.category === params.category);
    if (params.q)
      items = items.filter((i) => i.content.toLowerCase().includes(params.q!.toLowerCase()));
    return items;
  } finally {
    clearTimeout(t);
  }
}

export function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m lalu`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.round(h / 24)}h lalu`;
}
