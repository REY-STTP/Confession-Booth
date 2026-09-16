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
  roomSlug?: string;
  badgeType?: string;
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

export const BADGE_META: Record<
  string,
  { label: string; icon: string; desc: string; color: string }
> = {
  EMPATHETIC_LISTENER: {
    label: 'Empathetic Listener',
    icon: '🌿',
    desc: 'Memberikan empati dan reaksi pengertian kepada sesama',
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  MIDNIGHT_SOUL: {
    label: 'Midnight Soul',
    icon: '🌒',
    desc: 'Mencurahkan isi hati di keheningan larut malam (00:00 - 04:00)',
    color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  },
  CHAIN_WEAVER: {
    label: 'Chain Weaver',
    icon: '🧵',
    desc: 'Menyambung utas percakapan anonim dalam confession chains',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  STEALTH_CONFESSOR: {
    label: 'Stealth Confessor',
    icon: '🛡️',
    desc: 'Berbagi rahasia murni dengan Zero-Knowledge cryptographic stealth',
    color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  },
};

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
        name: 'Kampus & Kuliah',
        description: 'Rahasia seputar perkuliahan, tugas akhir, dan pertemanan kampus.',
        icon: '🎓',
        rules: 'Hargai sesama mahasiswa; dilarang doxxing.',
        sortOrder: 1,
        confessionCount: 0,
      },
      {
        slug: 'workplace-burnout',
        name: 'Work & Career',
        description: 'Tekanan deadline, imposter syndrome, toxic office, dan gaji.',
        icon: '💼',
        rules: 'Dilarang mencantumkan nama spesifik perusahaan/kolega.',
        sortOrder: 2,
        confessionCount: 0,
      },
      {
        slug: 'unsent-letters',
        name: 'Surat Tak Terkirim',
        description: 'Pesan, rindu, dan kata-kata yang tak sempat terucap.',
        icon: '✉️',
        rules: 'Tuliskan perasaan dengan jujur; jaga kerahasiaan identitas.',
        sortOrder: 3,
        confessionCount: 0,
      },
      {
        slug: 'deep-existential',
        name: 'Eksistensial & Makna',
        description: 'Pemikiran mendalam, arti hidup, filosofi, dan renungan sunyi.',
        icon: '🌌',
        rules: 'Ruang refleksi bebas stigma untuk pertanyaan terbesar hidup.',
        sortOrder: 4,
        confessionCount: 0,
      },
      {
        slug: 'midnight-thoughts',
        name: 'Midnight Sanctuary',
        description: 'Pelarian pikiran larut malam (00:00 - 04:00) saat dunia tertidur.',
        icon: '🌒',
        rules: 'Ekspresikan isi hatimu dengan tenang di keheningan malam.',
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
  if (mins < 60) return `${mins}m lalu`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.round(h / 24)}h lalu`;
}
