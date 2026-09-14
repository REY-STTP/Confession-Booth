'use client';

import { Suspense, useEffect, useState } from 'react';
import { getFeed, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';

function List({ sort, title, sub }: { sort: 'trending' | 'relatable'; title: string; sub: string }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getFeed({ sort })
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
  }, [sort]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-booth-dim">{sub}</p>
      </div>
      {offline ? (
        <p role="alert" className="rounded-lg border border-yellow-800 bg-yellow-950 p-3 text-sm text-yellow-200">
          API tidak terjangkau — menampilkan data cadangan.
        </p>
      ) : null}
      {!items ? <SkeletonList /> : items.length === 0 ? <Empty title="The booth is quiet." /> : (
        <div className="grid gap-4">{items.map((i) => <BoothCard key={i.id} item={i} />)}</div>
      )}
    </div>
  );
}

export default function TrendingPage() {
  return (
    <Suspense fallback={<SkeletonList />}>
      <List sort="trending" title="Trending" sub="Paling banyak dirasakan booth dalam 24 jam terakhir." />
    </Suspense>
  );
}
