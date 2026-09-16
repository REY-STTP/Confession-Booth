'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, PenLine, Sparkles, TrendingUp, Flame } from 'lucide-react';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';
import { getFeed, getRoom, type FeedItem, type RoomItem } from '@/lib/booth';
import { RoomIcon } from '@/components/icon-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function RoomFeedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [room, setRoom] = useState<RoomItem | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [sort, setSort] = useState<'new' | 'trending' | 'relatable'>('new');
  const [loading, setLoading] = useState(true);
  const [roomNotFound, setRoomNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoom(slug).then((r) => {
      if (cancelled) return;
      if (!r) {
        setRoomNotFound(true);
        return;
      }
      setRoom(r);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFeed({ room: slug, sort })
      .then((feed) => {
        if (!cancelled) {
          setItems(feed);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, sort]);

  if (roomNotFound) return notFound();

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to All Rooms</span>
        </Link>
      </div>

      {/* Room Hero Header */}
      {room ? (
        <div className="rounded-2xl border border-border/80 bg-card/80 p-6 sm:p-7 space-y-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shrink-0">
                <RoomIcon slug={room.slug} className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {room.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-primary bg-primary/10 border-primary/30"
                  >
                    #{room.slug}
                  </Badge>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {room.description}
                </p>
              </div>
            </div>

            <Link
              href={`/compose?room=${encodeURIComponent(room.slug)}`}
              className="self-start sm:self-auto shrink-0"
            >
              <Button size="sm" className="rounded-full gap-1.5 font-medium shadow-xs">
                <PenLine className="h-3.5 w-3.5" />
                <span>Write Confession</span>
              </Button>
            </Link>
          </div>

          {room.rules ? (
            <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground font-semibold">Room Guidelines: </strong>
                <span>{room.rules}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-6 space-y-3 animate-pulse">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'new', label: 'New', icon: Sparkles },
            { id: 'trending', label: 'Trending', icon: TrendingUp },
            { id: 'relatable', label: 'Relatable', icon: Flame },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = sort === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSort(tab.id as 'new' | 'trending' | 'relatable')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all select-none border',
                  isSel
                    ? 'border-primary/40 bg-primary/15 text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{items.length} confessions</span>
      </div>

      {/* Confession Feed */}
      {loading ? (
        <SkeletonList count={3} />
      ) : items.length === 0 ? (
        <Empty
          title="No confessions in this room yet"
          sub="Be the first to share your truth in this safe haven."
          action={
            <Link href="/compose">
              <Button size="sm" className="rounded-full gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                <span>Write the First Confession</span>
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <BoothCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
