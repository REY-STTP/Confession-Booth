'use client';

import * as React from 'react';
import Link from 'next/link';
import { Users, Sparkles, ArrowRight, ShieldCheck, PenLine, BookOpen } from 'lucide-react';
import { getRooms, type RoomItem, BADGE_META } from '@/lib/booth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function RoomsDirectoryPage() {
  const [rooms, setRooms] = React.useState<RoomItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
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
      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-card/50 p-6 sm:p-8 shadow-sm backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Community Rooms & Anon Reputation
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Ruang percakapan bertema terkurasi tanpa algoritma doxxing atau grafik follow. Temukan
              ruang yang tepat untuk mengungkapkan rasa dengan privasi absolut.
            </p>
          </div>

          <Link href="/compose" className="self-start sm:self-auto">
            <Button size="sm" className="rounded-full gap-1.5 font-medium shadow-xs">
              <PenLine className="h-3.5 w-3.5" />
              <span>Tulis ke Room</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid of Rooms */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <span>Daftar Kamar Komunitas</span>
            <Badge variant="outline" className="text-xs font-mono">
              {rooms.length} kamar aktif
            </Badge>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((r) => (
              <Link
                key={r.slug}
                href={`/rooms/${r.slug}`}
                className="group rounded-xl border border-border/75 bg-card/75 p-5 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-card-hover flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl" aria-hidden="true">
                        {r.icon}
                      </span>
                      <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                        {r.name}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] text-muted-foreground"
                    >
                      #{r.slug}
                    </Badge>
                  </div>

                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {r.description}
                  </p>

                  {r.rules ? (
                    <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs text-muted-foreground flex items-start gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="line-clamp-2">
                        <strong className="text-foreground font-medium">Pedoman: </strong>
                        {r.rules}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{r.confessionCount} pengakuan terbit</span>
                  <span className="text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 font-medium text-xs">
                    <span>Masuk Kamar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Soulbound Badges Showcase */}
      <section className="space-y-4 pt-4 border-t border-border/40">
        <div>
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <span>🎖️ Lencana Reputasi Anonim (Soulbound Badges)</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Reputasi terbukti secara kriptografis tanpa mengekspos profil atau alamat wallet Anda.
            Lencana diperoleh otomatis melalui kontribusi empati positif dan dapat dipasang secara
            opsional pada pengakuan atau bisikan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(BADGE_META).map(([key, meta]) => (
            <div
              key={key}
              className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <span className="font-semibold text-xs text-foreground">{meta.label}</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {meta.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-border/30">
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
