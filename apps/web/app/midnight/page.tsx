'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, AlertTriangle, Sparkles, PenLine } from 'lucide-react';
import { getFeed, getLastFeedError, type FeedItem } from '@/lib/booth';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';
import { FeedTabs } from '@/components/feed-tabs';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand-mark';

/** T1H-003: midnight resmi = tag kategori `midnight` ATAU jam 00–04 WIB (slot server).
 *  Time-window dihitung server-side (Asia/Jakarta); tanpa tracking lokasi user. */
function checkMidnightWib(): boolean {
  try {
    const now = new Date();
    const wibHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric',
        hour12: false,
      }).format(now),
      10,
    );
    return wibHour >= 0 && wibHour < 4;
  } catch {
    return false;
  }
}

function MidnightInner() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    setIsLive(checkMidnightWib());
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
    <div className="space-y-6">
      {/* Segmented feed tabs */}
      <FeedTabs />

      {/* Atmospheric Midnight Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-card/80 to-card p-6 sm:p-8 text-center shadow-lg">
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 h-36 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 shadow-inner">
            <Moon className="h-6 w-6" aria-hidden="true" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Midnight Confessions
          </h1>
          <p className="mt-2 text-xs sm:text-sm italic text-muted-foreground max-w-md">
            &ldquo;Things people only say when nobody is listening.&rdquo;
          </p>

          {/* Dynamic Active Hours Banner */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3.5 py-1 text-xs text-indigo-200">
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400/60'
              }`}
              aria-hidden="true"
            />
            <span className="font-medium">
              {isLive ? 'Jam Malam Aktif Sekarang' : 'Arsip Jam Malam (00:00 – 04:00 WIB)'}
            </span>
          </div>
        </div>
      </div>

      {/* Offline Alert */}
      {offline ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p>API tidak terjangkau — menampilkan data cadangan lokal.</p>
        </div>
      ) : null}

      {/* Feed List or States */}
      {!items ? (
        <SkeletonList count={4} />
      ) : items.length === 0 ? (
        <Empty
          title="Malam ini sunyi."
          sub="Belum ada pengakuan larut malam yang tertinggal di sini."
          action={
            <Link href="/compose">
              <Button size="sm" className="rounded-full gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                <span>Tulis Pengakuan Malam</span>
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

export default function MidnightPage() {
  return (
    <Suspense fallback={<SkeletonList count={4} />}>
      <MidnightInner />
    </Suspense>
  );
}
