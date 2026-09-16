'use client';

import * as React from 'react';
import {
  Wallet,
  LogOut,
  ShieldCheck,
  Award,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useSession } from '@/lib/session';
import { BADGE_META, getMyBadges, type UserBadgeItem } from '@/lib/booth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** T1-031: session nyata — visitor browse bebas, kontributor sign via wallet. */
export default function SettingsPage() {
  const { state, error, enter, logout, accessToken } = useSession();
  const [userBadges, setUserBadges] = React.useState<UserBadgeItem[]>([]);
  const busy = state === 'connecting' || state === 'signing';

  React.useEffect(() => {
    if (accessToken) {
      getMyBadges(accessToken)
        .then(setUserBadges)
        .catch(() => {});
    } else {
      setUserBadges([]);
    }
  }, [accessToken]);

  const earnedBadgeTypes = new Set(userBadges.map((b) => b.type));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Sesi & Pengaturan Privasi
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Kelola sesi wallet, verifikasi status anonim, dan pantau lencana reputasi komunitas Anda.
        </p>
      </div>

      {/* Session Status Card */}
      <div className="rounded-2xl border border-border/80 bg-card/85 p-5 sm:p-6 space-y-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border text-sm',
                state === 'booth'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Status Sesi Pengguna
              </h2>
              <p className="text-xs text-muted-foreground">
                {state === 'booth'
                  ? 'Di dalam booth — Sesi aktif terenkripsi'
                  : state === 'connecting'
                    ? 'Menghubungkan ke wallet...'
                    : state === 'signing'
                      ? 'Menunggu verifikasi signature...'
                      : 'Pengunjung Bebas (Visitor tanpa wallet)'}
              </p>
            </div>
          </div>

          <Badge
            variant={state === 'booth' ? 'zk' : 'outline'}
            className="text-[10px] font-mono capitalize"
          >
            {state === 'booth' ? '● Aktif' : '○ Visitor'}
          </Badge>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center justify-between">
            <span>Model Penyimpanan Token:</span>
            <span className="font-mono text-foreground">Memori Saja (Tanpa localStorage)</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Jaringan Target:</span>
            <span className="font-mono text-foreground">Ethereum Sepolia (Chain #11155111)</span>
          </div>
        </div>

        {state === 'booth' ? (
          <Button
            onClick={logout}
            variant="outline"
            className="w-full rounded-full border-border/80 hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive text-xs font-medium gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar dari Booth (Revoke Sesi)</span>
          </Button>
        ) : (
          <Button
            onClick={enter}
            disabled={busy}
            className="w-full rounded-full font-semibold text-sm gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memproses Hubungan Wallet...</span>
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                <span>Enter the Booth (Masuk Sesi)</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Soulbound Badges Gallery */}
      <div className="rounded-2xl border border-border/80 bg-card/85 p-5 sm:p-6 space-y-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Galeri Lencana Reputasi
            </h2>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            {userBadges.length} diraih
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Lencana soulbound anonim menandai partisipasi bermakna Anda tanpa mengungkap alamat
          wallet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {Object.entries(BADGE_META).map(([key, meta]) => {
            const isEarned = earnedBadgeTypes.has(key);

            return (
              <div
                key={key}
                className={cn(
                  'rounded-xl border p-3.5 space-y-2 transition-all flex flex-col justify-between',
                  isEarned
                    ? 'border-primary/40 bg-primary/5 shadow-xs'
                    : 'border-border/60 bg-card/40 opacity-50',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">
                        {meta.icon}
                      </span>
                      <span className="font-semibold text-xs text-foreground">{meta.label}</span>
                    </div>
                    {isEarned ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Terbuka
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-mono">Terkunci</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                    {meta.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/30">
                  <span
                    className={cn(
                      'inline-block text-[9px] font-mono px-2 py-0.5 rounded-full border',
                      isEarned ? meta.color : 'border-border text-muted-foreground',
                    )}
                  >
                    Non-transferable
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground space-y-1.5 backdrop-blur-xs">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Pemberitahuan Privasi & Keamanan</span>
        </p>
        <p className="leading-relaxed">
          Pengakuan bersifat publik, profil tidak harus demikian. Blockchain dan metadata jaringan
          dapat menimbulkan korelasi waktu. Jangan pernah menuliskan data pribadi yang mudah
          diidentifikasi. Sesi Anda kedaluwarsa secara otomatis saat ditutup.
        </p>
      </div>
    </div>
  );
}
