'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, AlertTriangle } from 'lucide-react';
import { getFeed, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';
import { FeedTabs } from '@/components/feed-tabs';
import { Button } from '@/components/ui/button';

function RelatableInner() {
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
    <div className="space-y-6">
      {/* Segmented feed tabs */}
      <FeedTabs />

      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Most Relatable
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Sorted by the most &ldquo;I understand&rdquo; reactions — deepest shared resonance from
            fellow visitors.
          </p>
        </div>
      </div>

      {/* Offline Alert */}
      {offline ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p>Sanctuary network unreachable — displaying cached local archive.</p>
        </div>
      ) : null}

      {/* Feed List or States */}
      {!items ? (
        <SkeletonList count={4} />
      ) : items.length === 0 ? (
        <Empty
          title="The booth is quiet."
          sub="No confessions have received resonance marks yet."
          action={
            <Link href="/feed">
              <Button variant="outline" size="sm" className="rounded-full">
                Explore Recent Confessions
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {items.map((i) => (
            <BoothCard key={i.id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RelatablePage() {
  return (
    <Suspense fallback={<SkeletonList count={4} />}>
      <RelatableInner />
    </Suspense>
  );
}
