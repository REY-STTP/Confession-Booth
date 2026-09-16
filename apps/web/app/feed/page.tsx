'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CATEGORIES, getFeedWithCursor, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';

function FeedInner({ sort }: { sort: 'new' | 'trending' | 'relatable' }) {
  const params = useSearchParams();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setNextCursor(null);
    setOffline(false);
    getFeedWithCursor({ sort, category: category || undefined, q: q || undefined })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setOffline(getLastFeedError()?.offline ?? false);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setNextCursor(null);
          setOffline(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sort, category, q]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getFeedWithCursor({
        sort,
        category: category || undefined,
        q: q || undefined,
        cursor: nextCursor,
      });
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setNextCursor(res.nextCursor);
    } catch {
      // Offline fallback atau network error
    } finally {
      setLoadingMore(false);
    }
  }

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
        <button className="rounded-lg border border-booth-line px-4 text-sm hover:border-booth-accent">
          Cari
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs" aria-label="Kategori">
        <a
          href="/feed"
          className={`rounded-full border px-2.5 py-1 ${!category ? 'border-booth-accent' : 'border-booth-line text-booth-dim'}`}
        >
          semua
        </a>
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

      {!items ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <Empty title="The booth is quiet." sub="Be the first to leave something behind." />
      ) : (
        <div className="grid gap-4">
          {offline ? (
            <p
              role="alert"
              className="rounded-lg border border-yellow-800 bg-yellow-950 p-3 text-sm text-yellow-200"
            >
              API tidak terjangkau — menampilkan data cadangan. Cek koneksi/NEXT_PUBLIC_API_URL.
            </p>
          ) : null}
          {items.map((i) => (
            <BoothCard key={i.id} item={i} />
          ))}

          {nextCursor ? (
            <div className="pt-2 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-full border border-booth-line bg-booth-panel px-6 py-2.5 text-sm text-booth-ink hover:border-booth-accent hover:bg-booth-accent/10 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Memuat confession…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          ) : null}
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
