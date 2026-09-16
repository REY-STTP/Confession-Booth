'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRooms, type RoomItem, BADGE_META } from '@/lib/booth';

export default function RoomsDirectoryPage() {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRooms()
      .then((data) => {
        setRooms(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="booth-card p-6 md:p-8 bg-gradient-to-br from-booth-panel via-booth-panel to-booth-panel/40 border-booth-line">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏛️</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-booth-ink">
              Community Rooms & Anon Reputation
            </h1>
            <p className="mt-1 text-sm text-booth-dim leading-relaxed">
              Ruang percakapan bertema terkurasi tanpa algoritma doxxing atau grafik follow.
              Ekspresikan perasaanmu dalam ruang yang tepat dengan perlindungan privasi absolut.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Rooms */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-booth-ink flex items-center gap-2">
            <span>Daftar Community Rooms</span>
            <span className="rounded-full bg-booth-line/40 px-2 py-0.5 text-xs text-booth-dim">
              {rooms.length} ruang aktif
            </span>
          </h2>
          <Link href="/compose" className="text-xs text-booth-accent hover:underline font-medium">
            + Tulis ke Room
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="booth-card p-5 animate-pulse space-y-3">
                <div className="h-6 w-1/3 bg-booth-line rounded" />
                <div className="h-4 w-full bg-booth-line rounded" />
                <div className="h-4 w-2/3 bg-booth-line rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((r) => (
              <Link
                key={r.slug}
                href={`/rooms/${r.slug}`}
                className="group booth-card p-5 transition-all hover:border-booth-accent/60 hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{r.icon}</span>
                      <h3 className="font-semibold text-booth-ink group-hover:text-booth-accent transition-colors">
                        {r.name}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-booth-dim">#{r.slug}</span>
                  </div>

                  <p className="mt-3 text-sm text-booth-dim leading-relaxed">{r.description}</p>

                  {r.rules ? (
                    <div className="mt-3 rounded-lg border border-booth-line/50 bg-booth-bg/40 p-2.5 text-xs text-booth-dim">
                      <strong className="text-booth-ink/80">Pedoman Room:</strong> {r.rules}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-booth-line/30 flex items-center justify-between text-xs text-booth-dim">
                  <span>{r.confessionCount} pengakuan terbit</span>
                  <span className="text-booth-accent group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-medium">
                    Masuk Room →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Anonymous Badges System Showcase (T3-002) */}
      <section className="space-y-4 pt-4 border-t border-booth-line/40">
        <div>
          <h2 className="text-lg font-semibold text-booth-ink flex items-center gap-2">
            <span>🎖️ Lencana Reputasi Anonim (Soulbound Badges)</span>
          </h2>
          <p className="mt-1 text-xs text-booth-dim leading-relaxed">
            Reputasi terbukti secara kriptografis tanpa mengekspos profil atau alamat wallet Anda.
            Lencana diperoleh otomatis melalui kontribusi positif dan dapat dipasang secara
            opsional.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(BADGE_META).map(([key, meta]) => (
            <div
              key={key}
              className="rounded-xl border border-booth-line/60 bg-booth-panel/60 p-4 space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="font-semibold text-xs text-booth-ink">{meta.label}</span>
                </div>
                <p className="mt-2 text-[11px] text-booth-dim leading-relaxed">{meta.desc}</p>
              </div>

              <div className="pt-2 border-t border-booth-line/30">
                <span
                  className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${meta.color}`}
                >
                  Non-transferable
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
