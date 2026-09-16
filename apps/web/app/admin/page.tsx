'use client';

import * as React from 'react';
import { ShieldCheck, Cpu, Database, FileText, AlertTriangle, Layers } from 'lucide-react';
import { CATEGORIES, API_URL } from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/** T1-034: admin config nyata — health chain + kategori seed + policy version. */
export default function AdminPage() {
  const { accessToken, state } = useSession();
  const [chain, setChain] = React.useState<{
    chainId?: string;
    contractConfigured?: boolean;
  } | null>(null);
  const [queueCount, setQueueCount] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/health/chain`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Chain health status: ${res.status}`);
        const body = await res.json();
        if (!cancelled) setChain(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chain health check failed.');
      }
      if (state === 'booth' && accessToken) {
        try {
          const q = await apiFetch('/api/moderation/queue?status=OPEN&limit=1', accessToken);
          if (q.ok) {
            const b = await q.json();
            if (!cancelled) setQueueCount((b.items ?? []).length);
          }
        } catch {
          // non-fatal for admin view
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, state]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/40 pb-4 space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            System Administration Dashboard
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Infrastructure configuration, blockchain network monitoring, and policy version
          verification.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4">
        {/* Chain Health Card */}
        <div className="rounded-2xl border border-border/80 bg-card/80 p-5 space-y-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Blockchain Health (Chain Health)
              </h2>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              Sepolia Testnet
            </Badge>
          </div>

          {!chain ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Configured Chain ID:</span>
                <span className="font-mono font-medium text-foreground">
                  {chain.chainId ?? '11155111'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Smart Contract Status:</span>
                <span className="font-mono text-emerald-400 font-medium">
                  {chain.contractConfigured ? '● Configured & Active' : '○ Not set'}
                </span>
              </div>
              {queueCount !== null ? (
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">Open Reports (OPEN):</span>
                  <span className="font-mono font-semibold text-foreground">
                    {queueCount} reports
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Categories Card */}
        <div className="rounded-2xl border border-border/80 bg-card/80 p-5 space-y-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Registered Emotion Categories ({CATEGORIES.length})
              </h2>
            </div>
            <span className="text-xs text-muted-foreground font-mono">All Active</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {CATEGORIES.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs text-muted-foreground font-medium"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="capitalize">{c}</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
            Category order and activation settings are managed via the backend database.
          </p>
        </div>

        {/* Policy Version Card */}
        <div className="rounded-2xl border border-border/80 bg-card/80 p-5 space-y-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Community Policy Versions
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-1">
              <span className="text-muted-foreground">Community Guidelines:</span>
              <p className="font-mono font-semibold text-foreground">Version 1.0 (Active)</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-1">
              <span className="text-muted-foreground">Privacy Policy:</span>
              <p className="font-mono font-semibold text-foreground">Version 1.0 (Active)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
