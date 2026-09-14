'use client';

import { useEffect, useState } from 'react';
import { getFeed, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';

/** T1H-003: midnight resmi = tag kategori `midnight` ATAU jam 00–04 WIB (slot server).
 *  Time-window dihitung server-side (Asia/Jakarta); tanpa tracking lokasi user.
 *  Notifikasi pasif ditunda (tanpa tracking agresif). */
export default function MidnightPage() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getFeed({ slot: 'midnight' })
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
      <div className="booth-card p-8 text-center">
        <h1 className="text-3xl font-bold">Midnight Confessions</h1>
        <p className="mt-2 text-sm italic text-booth-dim">Things people only say when nobody is listening.</p>
      </div>
      {offline ? (
        <p role="alert" className="rounded-lg border border-yellow-800 bg-yellow-950 p-3 text-sm text-yellow-200">
          API tidak terjangkau — menampilkan data cadangan.
        </p>
      ) : null}
      {!items ? <SkeletonList /> : items.length === 0 ? <Empty title="Malam ini sunyi." /> : (
        <div className="grid gap-4">{items.map((i) => <BoothCard key={i.id} item={i} />)}</div>
      )}
    </div>
  );
}
