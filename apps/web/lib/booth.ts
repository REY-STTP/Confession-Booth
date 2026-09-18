// Client data layer Fase 0: coba API nyata, fallback ke mock lokal bila API mati.
// Tidak ada wallet/secret yang disimpan di sini.
// T1-025: base URL dari NEXT_PUBLIC_API_URL (Vercel prod), fallback localhost hanya dev.
// P1 #11: konstanta runtime dari SSOT @booth/shared/constants (browser-safe,
// tanpa node:crypto). Web TIDAK mengimpor '@booth/shared' utama di bundle client.

import {
  BADGES as SHARED_BADGES,
  CATEGORIES as SHARED_CATEGORIES,
  countChars as sharedCountChars,
  isBadgeType,
  type BadgeType,
} from '@booth/shared/constants';

export type { BadgeType };
export { isBadgeType };

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
  roomSlug?: string;
  badgeType?: string;
  /** P1 #13: tipe reaksi milik pembaca (UPPER) — hanya bila terautentikasi. */
  reactedByMe?: string[];
}

export interface RoomItem {
  slug: string;
  name: string;
  description: string;
  icon: string;
  rules: string | null;
  sortOrder: number;
  confessionCount: number;
}

export interface UserBadgeItem {
  type: string;
  awardedAt: string;
}

export interface WhisperItem {
  id: string;
  parentWhisperId: string | null;
  author: { displayName: string };
  content: string;
  createdAt: string;
  isOp: boolean;
  badgeType?: string | null;
}

// P1 #11: metadata badge dari SSOT shared (bentuk Record dipertahankan untuk konsumen).
export const BADGE_META: Record<
  string,
  { label: string; icon: string; desc: string; color: string }
> = Object.fromEntries(
  SHARED_BADGES.map((b) => [
    b.type,
    { label: b.label, icon: b.icon, desc: b.desc, color: b.color },
  ]),
);

// P1 #7: nama publik aman terpusat — bila backend bug mengirim address,
// UI mana pun tidak boleh membocorkannya (fallback, tanpa log isi).
export function safeDisplayName(v: unknown, fallback = 'Anonymous #????'): string {
  if (typeof v !== 'string' || v.length === 0) return fallback;
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return fallback;
  return v;
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

// P1 #11: slug kategori dari SSOT shared (bentuk string[] dipertahankan).
export const CATEGORIES: string[] = SHARED_CATEGORIES.map((c) => c.slug);

const FALLBACK: FeedItem[] = [
  {
    id: 'c1',
    publicId: 'mock-1',
    author: { displayName: 'Anonymous #4821' },
    category: 'heartbreak',
    content: 'It has been three years, but every time that song plays, I still pause for a moment.',
    createdAt: new Date().toISOString(),
    reactions: { understand: 128, love: 31, sad: 72 },
    whisperCount: 21,
  },
  {
    id: 'c2',
    publicId: 'mock-2',
    author: { displayName: 'Anonymous #1173' },
    category: 'love',
    content: 'I told them I was fine when they left. Turns out I just was not ready to let go.',
    createdAt: new Date().toISOString(),
    reactions: { understand: 40, love: 90, sad: 12 },
    whisperCount: 8,
  },
  {
    id: 'c3',
    publicId: 'mock-3',
    author: { displayName: 'Anonymous #9021' },
    category: 'midnight',
    content: '2 AM and I am still thinking about a conversation from four years ago.',
    createdAt: new Date().toISOString(),
    reactions: { understand: 77, love: 5, sad: 30 },
    whisperCount: 15,
  },
];

// P1 #11: hitung code-point dari SSOT shared (nama export dipertahankan).
export const countChars: (s: string) => number = sharedCountChars;

export interface FeedResult {
  items: FeedItem[];
  nextCursor: string | null;
}

export async function getFeedWithCursor(
  params: {
    sort?: string;
    category?: string;
    room?: string;
    q?: string;
    slot?: string;
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<FeedResult> {
  const qs = new URLSearchParams({ sort: params.sort ?? 'new', limit: String(params.limit ?? 20) });
  if (params.category) qs.set('category', params.category);
  if (params.room) qs.set('room', params.room);
  if (params.q) qs.set('q', params.q);
  if (params.slot) qs.set('slot', params.slot);
  if (params.cursor) qs.set('cursor', params.cursor);
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
    return {
      items: (body.items ?? []) as FeedItem[],
      nextCursor: body.nextCursor ?? null,
    };
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
    return { items, nextCursor: null };
  } finally {
    clearTimeout(t);
  }
}

export async function getFeed(
  params: {
    sort?: string;
    category?: string;
    room?: string;
    q?: string;
    slot?: string;
    cursor?: string | null;
  } = {},
): Promise<FeedItem[]> {
  const res = await getFeedWithCursor(params);
  return res.items;
}

export async function getRooms(): Promise<RoomItem[]> {
  try {
    const res = await fetch(`${API}/api/rooms`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`rooms failed: ${res.status}`);
    const body = await res.json();
    return body.rooms ?? [];
  } catch {
    return [
      {
        slug: 'campus-life',
        name: 'Campus & Academy',
        description: 'Secrets surrounding university life, final theses, and campus friendships.',
        icon: 'graduation-cap',
        rules: 'Respect fellow students; no doxxing.',
        sortOrder: 1,
        confessionCount: 0,
      },
      {
        slug: 'workplace-burnout',
        name: 'Work & Career',
        description: 'Deadline pressure, imposter syndrome, toxic workplaces, and compensation.',
        icon: 'briefcase',
        rules: 'Do not name specific companies or colleagues.',
        sortOrder: 2,
        confessionCount: 0,
      },
      {
        slug: 'unsent-letters',
        name: 'Unsent Letters',
        description: 'Messages, longings, and words left forever unspoken.',
        icon: 'mail',
        rules: 'Write with honest emotion; preserve identity privacy.',
        sortOrder: 3,
        confessionCount: 0,
      },
      {
        slug: 'deep-existential',
        name: 'Existential & Meaning',
        description: 'Deep thoughts, purpose of life, philosophy, and quiet reflections.',
        icon: 'compass',
        rules: 'Stigma-free reflection space for life’s deepest questions.',
        sortOrder: 4,
        confessionCount: 0,
      },
      {
        slug: 'midnight-thoughts',
        name: 'Midnight Sanctuary',
        description: 'Late-night thoughts (00:00 - 04:00) while the rest of the world sleeps.',
        icon: 'moon',
        rules: 'Express your heart softly in the stillness of the night.',
        sortOrder: 5,
        confessionCount: 0,
      },
    ];
  }
}

export async function getRoom(slug: string): Promise<RoomItem | null> {
  try {
    const res = await fetch(`${API}/api/rooms/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as RoomItem;
  } catch {
    return null;
  }
}

export async function getMyBadges(accessToken: string): Promise<UserBadgeItem[]> {
  try {
    const res = await fetch(`${API}/api/me/badges`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.badges ?? [];
  } catch {
    return [];
  }
}

export async function getWhispers(publicId: string): Promise<WhisperItem[]> {
  try {
    const res = await fetch(`${API}/api/confessions/${encodeURIComponent(publicId)}/whispers`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.items ?? [];
  } catch {
    return [];
  }
}

export function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
