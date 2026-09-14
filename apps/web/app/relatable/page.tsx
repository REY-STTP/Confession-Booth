'use client';

import { useEffect, useState } from 'react';
import { getFeed, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';

export default function RelatablePage() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getFeed({ sort: 'relatable' })
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
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Most Relatable</h1>
        <p className="mt-1 text-sm text-booth-dim">Diurutkan dari reaksi 🕯️ I understand terbanyak.</p>
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
