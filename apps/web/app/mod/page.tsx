'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  EyeOff,
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { SkeletonList } from '@/app/components/booth-card';
import { useSession, apiFetch } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QueueItem {
  reportId: string;
  targetType: 'CONFESSION' | 'WHISPER';
  targetPublicId: string | null;
  targetStatus: string | null;
  reason: string;
  status: string;
  createdAt: string;
  preview: string | null;
}

/** T1-034: dashboard moderator nyata — antrean + aksi <3 klik + audit. */
function ModInner() {
  const { accessToken, state } = useSession();
  const [status, setStatus] = useState('OPEN');
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    if (state !== 'booth' || !accessToken) {
      setItems([]);
      return;
    }
    setError('');
    try {
      const res = await apiFetch(
        `/api/moderation/queue?status=${encodeURIComponent(status)}&limit=20`,
        accessToken,
      );
      if (res.status === 401) throw new Error('Session expired — please enter the booth again.');
      if (res.status === 403)
        throw new Error('Access denied: Requires MODERATOR or ADMIN privileges.');
      if (!res.ok) throw new Error(`Failed to load queue: status ${res.status}`);
      const body = await res.json();
      setItems(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load moderation queue.');
      setItems([]);
    }
  }, [accessToken, state, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(targetType: string, targetPublicId: string | null, action: string) {
    if (!targetPublicId || !accessToken) return;
    setActing(`${action}:${targetPublicId}`);
    setError('');
    try {
      const res = await apiFetch('/api/moderation/actions', accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId: targetPublicId,
          action,
          reason_code: 'SPAM',
          policy_version: 'v1.0',
        }),
      });
      if (!res.ok) throw new Error(`Action execution failed (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Moderation action failed.');
    } finally {
      setActing('');
    }
  }

  if (state !== 'booth') {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/80 p-8 text-center space-y-3 max-w-lg mx-auto">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-400" />
        <h2 className="text-lg font-semibold text-foreground">Moderation Queue</h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Please enter the booth with a wallet holding MODERATOR permissions. Moderator identities
          are never disclosed to the public.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Moderation Queue</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Review community content reports. Actions taken are immutably logged in the audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="mod-status" className="text-xs text-muted-foreground whitespace-nowrap">
            Filter:
          </label>
          <select
            id="mod-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            aria-label="Filter queue status"
          >
            {['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
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

      {/* Queue Items */}
      {!items ? (
        <SkeletonList count={3} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center text-xs sm:text-sm text-muted-foreground">
          <CheckCircle className="mx-auto h-8 w-8 text-emerald-400 mb-2 opacity-80" />
          <p className="font-medium text-foreground">Queue Clean</p>
          <p className="mt-1">No reports with status {status} at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((q) => {
            const isTargetActing = acting.includes(q.targetPublicId ?? '');

            return (
              <div
                key={q.reportId}
                className="rounded-xl border border-border/75 bg-card/80 p-5 space-y-3 shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {q.targetType}
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {q.targetPublicId ?? '(target deleted)'}
                    </span>
                    <Badge variant="destructive" className="text-[10px]">
                      {q.reason}
                    </Badge>
                  </div>

                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(q.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Content Preview */}
                <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs text-foreground/90 font-sans leading-relaxed break-words">
                  {q.preview ? `"${q.preview}"` : '— (Content preview unavailable)'}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs flex-wrap gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Target Status:{' '}
                    <strong className="font-mono text-foreground">{q.targetStatus ?? '?'}</strong>
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isTargetActing}
                      onClick={() => act(q.targetType, q.targetPublicId, 'DISMISS')}
                      className="rounded-full text-xs h-8 px-3"
                    >
                      Dismiss
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isTargetActing}
                      onClick={() => act(q.targetType, q.targetPublicId, 'HIDE')}
                      className="rounded-full text-xs h-8 px-3 gap-1"
                    >
                      <EyeOff className="h-3 w-3" />
                      <span>Hide</span>
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isTargetActing}
                      onClick={() => act(q.targetType, q.targetPublicId, 'REMOVE')}
                      className="rounded-full text-xs h-8 px-3 gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>{isTargetActing ? 'Processing...' : 'Remove'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Audit reassurance footer */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          All moderation decisions are recorded in permanent audit logs (actor, reason code,
          timestamp, and policy version v1.0). Moderator identities are never revealed publicly.
        </span>
      </div>
    </div>
  );
}

export default function ModPage() {
  return (
    <Suspense fallback={<SkeletonList count={3} />}>
      <ModInner />
    </Suspense>
  );
}
