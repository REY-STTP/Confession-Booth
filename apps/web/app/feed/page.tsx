'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CATEGORIES, getFeed, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';

function FeedInner({ sort }: { sort: 'new' | 'trending' | 'relatable' }) {
  const params = useSearchParams();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setOffline(false);
    getFeed({ sort, category: category || undefined, q: q || undefined })
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setOffline(getLastFeedError()?.offline ?? false);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setOffline(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sort, category, q]);

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 text-sm" aria-label="Urutkan">
        {(['new', 'trending', 'relatable'] as const).map((s) => (
          <a
            key={s}
            aria-current={sort === s ? 'page' : undefined}
            href={s === 'new' ? '/feed' : `/${s}`}
            className={`rounded-full border px-3 py-1.5 ${sort === s ? 'border-booth-accent text-booth-ink' : 'border-booth-line text-booth-dim'}`}
          >
            {s === 'new' ? 'New' : s === 'trending' ? 'Trending' : 'Most Relatable'}
          </a>
        ))}
      </nav>

      <form action="/feed" method="get" className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari confession…"
          className="flex-1 rounded-lg border border-booth-line bg-booth-panel p-2.5 text-sm"
          maxLength={200}
        />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button className="rounded-lg border border-booth-line px-4 text-sm">Cari</button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs" aria-label="Kategori">
        <a href="/feed" className={`rounded-full border px-2.5 py-1 ${!category ? 'border-booth-accent' : 'border-booth-line text-booth-dim'}`}>semua</a>
        {CATEGORIES.map((c) => (
          <a
            key={c}
            href={`/feed?category=${c}`}
            className={`rounded-full border px-2.5 py-1 ${category === c ? 'border-booth-accent' : 'border-booth-line text-booth-dim'}`}
          >
            {c}
          </a>
        ))}
      </div>

      {!items ? <SkeletonList /> : items.length === 0 ? (
        <Empty title="The booth is quiet." sub="Be the first to leave something behind." />
      ) : (
        <div className="grid gap-4">
          {offline ? (
            <p role="alert" className="rounded-lg border border-yellow-800 bg-yellow-950 p-3 text-sm text-yellow-200">
              API tidak terjangkau — menampilkan data cadangan. Cek koneksi/NEXT_PUBLIC_API_URL.
            </p>
          ) : null}
          {items.map((i) => <BoothCard key={i.id} item={i} />)}
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<SkeletonList />}>
      <FeedInner sort="new" />
    </Suspense>
  );
}
