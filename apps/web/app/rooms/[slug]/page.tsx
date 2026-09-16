'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoothCard, Empty, SkeletonList } from '@/app/components/booth-card';
import { getFeed, getRoom, type FeedItem, type RoomItem } from '@/lib/booth';

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
          className="inline-flex items-center gap-1.5 text-xs text-booth-dim hover:text-booth-ink transition-colors"
        >
          ← Kembali ke Semua Rooms
        </Link>
      </div>

      {/* Room Hero Header */}
      {room ? (
        <div className="booth-card p-6 border-booth-line space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{room.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold text-booth-ink">{room.name}</h1>
                  <span className="font-mono text-xs text-booth-dim bg-booth-line/30 px-2 py-0.5 rounded-full">
                    #{room.slug}
                  </span>
                </div>
                <p className="mt-1 text-sm text-booth-dim">{room.description}</p>
              </div>
            </div>

            <Link
              href="/compose"
              className="rounded-lg bg-booth-accent px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition text-center shrink-0"
            >
              + Buat Pengakuan
            </Link>
          </div>

          {room.rules ? (
            <div className="rounded-lg border border-booth-line/60 bg-booth-bg/40 p-3 text-xs text-booth-dim flex items-start gap-2">
              <span className="text-booth-accent font-bold">📜</span>
              <div>
                <strong className="text-booth-ink font-semibold">Pedoman Khusus Room: </strong>
                <span>{room.rules}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="booth-card p-6 animate-pulse space-y-3">
          <div className="h-6 w-1/3 bg-booth-line rounded" />
          <div className="h-4 w-full bg-booth-line rounded" />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-booth-line pb-3">
        <div className="flex gap-2">
          {(['new', 'trending', 'relatable'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                sort === s
                  ? 'bg-booth-accent text-black font-semibold'
                  : 'text-booth-dim hover:text-booth-ink'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-booth-dim">{items.length} pengakuan</span>
      </div>

      {/* Confession Feed */}
      {loading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <Empty
          title="Belum ada pengakuan di room ini"
          sub="Jadilah yang pertama mencurahkan isi hatimu di ruang aman ini."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <BoothCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
