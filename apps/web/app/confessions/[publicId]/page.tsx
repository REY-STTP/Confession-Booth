'use client';

import { use, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Share2,
  Flag,
  Check,
  CornerDownRight,
  Send,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { BoothCard } from '@/app/components/booth-card';
import { ProofInspector } from '@/components/proof-inspector';
import { WhisperThread } from '@/components/whisper-thread';
import { ReportDialog } from '@/components/report-dialog';
import { ReactionIcon, BadgeIcon } from '@/components/icon-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  API_URL,
  countChars,
  type FeedItem,
  type WhisperItem,
  type UserBadgeItem,
  BADGE_META,
  getMyBadges,
} from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';

const REACTION_BUTTONS = [
  { type: 'UNDERSTAND', label: 'Understand' },
  { type: 'LOVE', label: 'Love' },
  { type: 'SAD', label: 'Sad' },
  { type: 'WILD', label: 'Wild' },
  { type: 'FUNNY', label: 'Funny' },
] as const;

/** T1-032 / T3-001 / T3-002: Detail confession dengan Confession Chains, OP tag, dan lencana. */
export default function DetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  const { accessToken, state } = useSession();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [whispers, setWhispers] = useState<WhisperItem[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reacted, setReacted] = useState<Record<string, boolean>>({});
  // P1 #13: cegah inisialisasi ulang menimpa toggle optimistik pengguna.
  const [reactedInit, setReactedInit] = useState(false);
  const [whisper, setWhisper] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadgeItem[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<string>('');
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/confessions/${encodeURIComponent(publicId)}`, {
          cache: 'no-store',
        });
        if (res.status === 404) {
          if (!cancelled) setMissing(true);
          return;
        }
        if (!res.ok) throw new Error(`detail failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (
          typeof data?.author?.displayName === 'string' &&
          /^0x[a-fA-F0-9]{40}$/.test(data.author.displayName)
        ) {
          if (!cancelled) setLoadError('Respons invalid (identitas bocor).');
          return;
        }
        setItem(data);
        // P1 #13: pulihkan status reacted dari server (tahan refresh).
        // Merge di bawah toggle pengguna (tak ada interaksi sebelum item tampil).
        if (Array.isArray(data?.reactedByMe)) {
          const init: Record<string, boolean> = {};
          for (const t of data.reactedByMe) {
            if (typeof t === 'string' && t) init[t] = true;
          }
          if (!cancelled) setReacted((prev) => ({ ...init, ...prev }));
        }
        try {
          const w = await fetch(
            `${API_URL}/api/confessions/${encodeURIComponent(publicId)}/whispers`,
            { cache: 'no-store' },
          ).then((r) => {
            if (!r.ok) throw new Error(`whispers failed: ${r.status}`);
            return r.json();
          });
          if (!cancelled) setWhispers(w.items ?? []);
        } catch {
          if (!cancelled) setLoadError('Whispers failed to load. Please refresh.');
        }
      } catch {
        if (!cancelled)
          setLoadError('Confession failed to load. Check your network or API connection.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  // P1 #13: fetch awal anonim — susulkan fetch terautentikasi saat token tiba
  // (mis. pulih sesi) agar reactedByMe terisi tanpa reload.
  useEffect(() => {
    if (!accessToken || !item || reactedInit) return;
    let cancelled = false;
    apiFetch(`/api/confessions/${encodeURIComponent(publicId)}`, accessToken)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.reactedByMe)) return;
        const init: Record<string, boolean> = {};
        for (const t of data.reactedByMe) {
          if (typeof t === 'string' && t) init[t] = true;
        }
        setReacted((prev) => ({ ...init, ...prev }));
        setReactedInit(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, item, publicId, reactedInit]);

  useEffect(() => {
    if (accessToken) {
      getMyBadges(accessToken)
        .then(setUserBadges)
        .catch(() => {});
    } else {
      setUserBadges([]);
    }
  }, [accessToken]);

  async function react(type: string) {
    if (state !== 'booth' || !accessToken) {
      toast.error('Enter booth first', {
        description: 'Connect your wallet to react to confessions.',
      });
      return;
    }
    const on = !reacted[type];
    const key = type.toLowerCase();

    // AUDIT FG-003 & UX-003: Toggle un-react dan update state optimistik seketika
    setReacted((s) => ({ ...s, [type]: on }));
    setItem((prev) => {
      if (!prev) return prev;
      const current = prev.reactions[key] ?? 0;
      return {
        ...prev,
        reactions: {
          ...prev.reactions,
          [key]: Math.max(0, current + (on ? 1 : -1)),
        },
      };
    });

    try {
      // Kontrak API: POST { type: UPPERCASE } (bukan { reaction: lowercase }).
      const res = on
        ? await apiFetch(`/api/confessions/${publicId}/reactions`, accessToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
          })
        : await apiFetch(`/api/confessions/${publicId}/reactions/${type}`, accessToken, {
            method: 'DELETE',
          });

      if (!res.ok) throw new Error(`react failed: ${res.status}`);
    } catch {
      // Rollback jika request gagal
      setReacted((s) => ({ ...s, [type]: !on }));
      setItem((prev) => {
        if (!prev) return prev;
        const current = prev.reactions[key] ?? 0;
        return {
          ...prev,
          reactions: {
            ...prev.reactions,
            [key]: Math.max(0, current + (on ? -1 : 1)),
          },
        };
      });
      toast.error('Failed to update reaction');
    }
  }

  async function handleShare() {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Confession link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }

  async function sendWhisper(e: React.FormEvent) {
    e.preventDefault();
    if (!whisper.trim()) return;
    // P2 #17: hitung code-point seperti server (emoji/ZWJ ≠ UTF-16 units).
    if (countChars(whisper) > 300) {
      toast.error('Whispers must be at most 300 characters');
      return;
    }
    if (/<[a-zA-Z/!]/.test(whisper)) {
      toast.error('HTML is not allowed in whispers');
      return;
    }
    if (state !== 'booth' || !accessToken) {
      toast.error('Enter booth first', {
        description: 'Connect your wallet to send anonymous whispers.',
      });
      return;
    }

    setIsSubmitting(true);
    const content = whisper;
    const parentId = replyTo?.id;
    // P2 #18: idempotency per submit (retry aman).
    const idemKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const send = (pow?: string) =>
        apiFetch(`/api/confessions/${encodeURIComponent(publicId)}/whispers`, accessToken, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idemKey,
            ...(pow ? { 'x-pow-solution': pow } : {}),
          },
          body: JSON.stringify({
            content,
            parentWhisperId: parentId || undefined,
            badgeType: selectedBadge || undefined,
          }),
        });
      let res = await send();
      // P2 #18: jawab tantangan PoW sekali lalu retry (seperti composer).
      if (res.status === 429) {
        const { extractPowChallenge, solvePowBrowser } = await import('@/lib/pow');
        const ch = extractPowChallenge(await res.json().catch(() => ({})));
        if (ch?.token && typeof ch.difficulty === 'number') {
          const nonceN = await solvePowBrowser(ch.token.split('.')[0], ch.difficulty);
          if (nonceN === null) throw new Error('POW_FAILED — device computation timed out.');
          res = await send(`${ch.token}:${nonceN}`);
        }
      }
      if (!res.ok) throw new Error(`whisper failed: ${res.status}`);
      const created = await res.json().catch(() => null);
      const newWhisper: WhisperItem = {
        id: created?.id ?? `local-${Date.now()}`,
        parentWhisperId: parentId ?? null,
        // P2 #22: placeholder pending (bukan #0000 yang menyerupai nomor asli).
        author: { displayName: 'Anonymous #…' },
        content,
        createdAt: new Date().toISOString(),
        isOp: false,
        badgeType: selectedBadge || null,
      };
      setWhispers((w) => [...w, newWhisper]);
      setWhisper('');
      setReplyTo(null);
      toast.success('Anonymous whisper sent!');
    } catch {
      toast.error('Failed to send whisper. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (missing) return notFound();

  if (loadError && !item) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive">
        <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
        <p className="font-semibold text-base">{loadError}</p>
        <Link href="/feed" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Back to Feed
          </Button>
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-6 space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Feed</span>
        </Link>
      </div>

      {/* Prominent Confession Card */}
      <BoothCard item={item} />

      {/* Cryptographic Proof Inspector Accordion */}
      <ProofInspector publicId={item.publicId} proofType={item.proofType} />

      {/* Reaction & Action Controls Bar */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/60 p-2.5 sm:p-3 backdrop-blur-sm"
        aria-label="Reactions and actions"
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {REACTION_BUTTONS.map(({ type: t, label }) => {
            const isPressed = Boolean(reacted[t]);
            const count = item.reactions[t.toLowerCase()] ?? 0;

            return (
              <button
                key={t}
                onClick={() => react(t)}
                aria-pressed={isPressed}
                aria-label={`React ${label}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border select-none outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isPressed
                    ? 'border-primary/50 bg-primary/15 text-primary shadow-xs'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border'
                }`}
              >
                <ReactionIcon type={t} />
                <span>{label}</span>
                {count > 0 ? (
                  <span className="font-mono text-[11px] opacity-80">({count})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Share & Report Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="rounded-full gap-1.5 text-xs"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReportOpen(true)}
            className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Flag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Report</span>
          </Button>
        </div>
      </div>

      {/* Confession Chains & Whispers Section */}
      <section aria-label="Confession Chains & Whispers" className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-base sm:text-lg tracking-tight text-foreground">
              Confession Chains ({whispers.length})
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">Safe &amp; anonymous discussion</span>
        </div>

        {/* Whisper Reply Form */}
        <div className="rounded-xl border border-border/80 bg-card/80 p-4 space-y-3 shadow-sm">
          {replyTo ? (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs text-primary">
              <span className="flex items-center gap-1.5">
                <CornerDownRight className="h-3.5 w-3.5" />
                <span>
                  Replying to <strong>{replyTo.author}</strong> (Continuing conversation chain)
                </span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="inline-flex items-center gap-1 font-semibold ml-2 hover:underline text-foreground"
              >
                <X className="h-3 w-3" />
                <span>Cancel</span>
              </button>
            </div>
          ) : null}

          <form onSubmit={sendWhisper} className="space-y-3">
            <div className="flex gap-2">
              <input
                id="whisper-input"
                value={whisper}
                onChange={(e) => setWhisper(e.target.value)}
                placeholder={
                  replyTo
                    ? `Reply to ${replyTo.author} anonymously...`
                    : 'Send an anonymous whisper to this confession...'
                }
                maxLength={300}
                className="flex-1 rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Write a whisper"
              />
              <Button
                type="submit"
                disabled={isSubmitting || !whisper.trim()}
                className="rounded-xl font-medium px-5 gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>{replyTo ? 'Reply' : 'Send'}</span>
                  </>
                )}
              </Button>
            </div>

            {/* Character count & Badges */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              {/* Badge picker */}
              {userBadges.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-[11px]">Attach badge:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBadge('')}
                    className={`rounded-full px-2 py-0.5 border text-[10px] font-medium transition-colors ${
                      !selectedBadge
                        ? 'border-primary/50 bg-primary/20 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    None
                  </button>
                  {userBadges.map((b) => {
                    const meta = BADGE_META[b.type];
                    if (!meta) return null;
                    const isSel = selectedBadge === b.type;
                    return (
                      <button
                        key={b.type}
                        type="button"
                        onClick={() => setSelectedBadge(isSel ? '' : b.type)}
                        className={`rounded-full px-2 py-0.5 border text-[10px] flex items-center gap-1 transition-all ${
                          isSel
                            ? `${meta.color} font-medium ring-1 ring-current`
                            : 'border-border text-muted-foreground hover:border-border/80'
                        }`}
                      >
                        <BadgeIcon type={b.type} className="h-3 w-3" />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  All whispers appear anonymous publicly, but are sent under your session
                  (pseudonymous — not zero-knowledge).
                </span>
              )}

              <span
                className={`font-mono text-[11px] ml-auto ${
                  countChars(whisper) > 270 ? 'text-amber-400' : 'text-muted-foreground'
                }`}
              >
                {countChars(whisper)}/300
              </span>
            </div>
          </form>
        </div>

        {/* Threaded whispers tree */}
        <WhisperThread
          whispers={whispers}
          onReply={(target) => {
            setReplyTo(target);
            const el = document.getElementById('whisper-input');
            el?.focus();
          }}
          replyTo={replyTo}
        />
      </section>

      {/* Modern Report Dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetId={item.publicId}
        targetType="CONFESSION"
      />
    </div>
  );
}
