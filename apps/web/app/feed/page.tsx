'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, AlertTriangle, Loader2, PenLine, X } from 'lucide-react';
import { getFeedWithCursor, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';
import { FeedTabs } from '@/components/feed-tabs';
import { CategoryPills } from '@/components/category-pills';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

  const hasFilter = Boolean(category || q);

  return (
    <div className="space-y-6">
      {/* Segmented feed tabs */}
      <FeedTabs />

      {/* Search Bar */}
      <form action="/feed" method="get" className="flex items-center gap-2" role="search">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search confessions or keywords..."
            className="pl-9 h-10 bg-card/60 border-border/80 text-sm focus-visible:ring-primary rounded-xl"
            maxLength={200}
          />
        </div>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <Button
          type="submit"
          variant="secondary"
          size="default"
          className="rounded-xl px-4 font-medium h-10"
        >
          Search
        </Button>
      </form>

      {/* Horizontal Category Pills */}
      <CategoryPills activeCategory={category} searchQuery={q} />

      {/* Active Filter Indicator */}
      {hasFilter ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Active filters:</span>
            {category ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary font-medium">
                #{category}
              </span>
            ) : null}
            {q ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-foreground font-mono">
                &ldquo;{q}&rdquo;
              </span>
            ) : null}
          </div>
          <Link
            href="/feed"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </Link>
        </div>
      ) : null}

      {/* Offline Alert */}
      {offline ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p>
            API unreachable — displaying local fallback cache. Check your internet connection or
            server status.
          </p>
        </div>
      ) : null}

      {/* Feed List or States */}
      {!items ? (
        <SkeletonList count={4} />
      ) : items.length === 0 ? (
        <Empty
          title={hasFilter ? 'No matching confessions found' : 'The booth is quiet.'}
          sub={
            hasFilter
              ? 'Try adjusting your search keywords or clearing category filters.'
              : 'Be the first soul to leave an imprint in this sanctuary.'
          }
          action={
            hasFilter ? (
              <Link href="/feed">
                <Button variant="outline" size="sm" className="rounded-full">
                  View All Confessions
                </Button>
              </Link>
            ) : (
              <Link href="/compose">
                <Button size="sm" className="rounded-full gap-1.5">
                  <PenLine className="h-3.5 w-3.5" />
                  <span>Write a Confession</span>
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-4">
          {items.map((i) => (
            <BoothCard key={i.id} item={i} />
          ))}

          {/* Load More Button */}
          {nextCursor ? (
            <div className="pt-3 text-center">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
                size="lg"
                className="rounded-full px-8 border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-200"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                    <span>Loading confessions...</span>
                  </>
                ) : (
                  <span>Load More</span>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<SkeletonList count={4} />}>
      <FeedInner sort="new" />
    </Suspense>
  );
}
