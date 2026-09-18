'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  PenLine,
  BookOpen,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { getRooms, getLastFeedError, type RoomItem, BADGE_META } from '@/lib/booth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RoomIcon, BadgeIcon } from '@/components/icon-helpers';

export default function RoomsDirectoryPage() {
  const [rooms, setRooms] = React.useState<RoomItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  // P2 #17: banner offline jujur seperti feed.
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    getRooms()
      .then((data) => {
        setRooms(data);
        setOffline(getLastFeedError()?.offline ?? false);
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
              Curated themed sanctuaries free from profiling algorithms and follower graphs. Find
              the fitting sanctuary to express your truth with absolute privacy.
            </p>
          </div>

          <Link href="/compose" className="self-start sm:self-auto">
            <Button size="sm" className="rounded-full gap-1.5 font-medium shadow-xs">
              <PenLine className="h-3.5 w-3.5" />
              <span>Write to Room</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid of Rooms */}
      {/* P2 #17: banner offline jujur (fallback room statis). */}
      {offline && !loading ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p>API unreachable — displaying local fallback cache.</p>
        </div>
      ) : null}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <span>Community Sanctuaries</span>
            <Badge variant="outline" className="text-xs font-mono">
              {rooms.length} active rooms
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
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary group-hover:border-primary/40 transition-colors">
                        <RoomIcon slug={r.slug} className="h-5 w-5" />
                      </div>
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
                        <strong className="text-foreground font-medium">Guidelines: </strong>
                        {r.rules}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{r.confessionCount} confessions published</span>
                  <span className="text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 font-medium text-xs">
                    <span>Enter Room</span>
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
            <Award className="h-5 w-5 text-amber-400" />
            <span>Anonymous Reputation (Soulbound Badges)</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Cryptographically proven reputation without exposing your profile or wallet address.
            Badges are earned through empathetic contributions and can be optionally attached to
            confessions or whispers.
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
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <BadgeIcon type={key} className="h-4 w-4" />
                  </div>
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
