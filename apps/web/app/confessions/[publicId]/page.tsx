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
} from 'lucide-react';
import { toast } from 'sonner';
import { BoothCard } from '@/app/components/booth-card';
import { ProofInspector } from '@/components/proof-inspector';
import { WhisperThread } from '@/components/whisper-thread';
import { ReportDialog } from '@/components/report-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  API_URL,
  type FeedItem,
  type WhisperItem,
  type UserBadgeItem,
  BADGE_META,
  getMyBadges,
} from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';

const REACTION_BUTTONS = [
  { type: 'UNDERSTAND', emoji: '🕯️', label: 'Understand' },
  { type: 'LOVE', emoji: '❤️', label: 'Love' },
  { type: 'SAD', emoji: '😭', label: 'Sad' },
  { type: 'WILD', emoji: '💀', label: 'Wild' },
  { type: 'FUNNY', emoji: '😂', label: 'Funny' },
] as const;

/** T1-032 / T3-001 / T3-002: Detail confession dengan Confession Chains, OP tag, dan lencana. */
export default function DetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  const { accessToken, state } = useSession();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [whispers, setWhispers] = useState<WhisperItem[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reacted, setReacted] = useState<Record<string, boolean>>({});
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
          if (!cancelled) setLoadError('Whisper gagal dimuat. Coba muat ulang.');
        }
      } catch {
        if (!cancelled) setLoadError('Confession gagal dimuat. Cek koneksi/API.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicId]);

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
      toast.error('Masuk booth dulu', {
        description: 'Hubungkan wallet Anda untuk memberikan reaksi pada pengakuan.',
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
      const res = on
        ? await apiFetch(
            `/api/confessions/${encodeURIComponent(publicId)}/reactions`,
            accessToken,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type }),
            },
          )
        : await apiFetch(
            `/api/confessions/${encodeURIComponent(publicId)}/reactions/${encodeURIComponent(type)}`,
            accessToken,
            {
              method: 'DELETE',
            },
          );

      if (!res.ok) throw new Error(`react failed: ${res.status}`);
    } catch {
      // Revert rollback bila gagal
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
      toast.error('Gagal memperbarui reaksi');
    }
  }

  async function handleShare() {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Tautan confession berhasil disalin!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Gagal menyalin tautan');
    }
  }

  async function sendWhisper(e: React.FormEvent) {
    e.preventDefault();
    if (!whisper.trim()) return;
    if (whisper.length > 300) {
      toast.error('Whisper maksimal 300 karakter');
      return;
    }
    if (/<[a-zA-Z/!]/.test(whisper)) {
      toast.error('HTML tidak diizinkan di whisper');
      return;
    }
    if (state !== 'booth' || !accessToken) {
      toast.error('Masuk booth dulu', {
        description: 'Hubungkan wallet Anda untuk mengirim bisikan anonim.',
      });
      return;
    }

    setIsSubmitting(true);
    const content = whisper;
    const parentId = replyTo?.id;
    try {
      const res = await apiFetch(
        `/api/confessions/${encodeURIComponent(publicId)}/whispers`,
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            parentWhisperId: parentId || undefined,
            badgeType: selectedBadge || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error(`whisper failed: ${res.status}`);
      const created = await res.json().catch(() => null);
      const newWhisper: WhisperItem = {
        id: created?.id ?? `local-${Date.now()}`,
        parentWhisperId: parentId ?? null,
        author: { displayName: 'Anonymous #0000' },
        content,
        createdAt: new Date().toISOString(),
        isOp: false,
        badgeType: selectedBadge || null,
      };
      setWhispers((w) => [...w, newWhisper]);
      setWhisper('');
      setReplyTo(null);
      toast.success('Bisikan anonim terkirim!');
    } catch {
      toast.error('Whisper gagal terkirim. Coba lagi.');
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
            Kembali ke Feed
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
          <span>Kembali ke Feed</span>
        </Link>
      </div>

      {/* Prominent Confession Card */}
      <BoothCard item={item} />

      {/* Cryptographic Proof Inspector Accordion */}
      <ProofInspector publicId={item.publicId} proofType={item.proofType} />

      {/* Reaction & Action Controls Bar */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/60 p-2.5 sm:p-3 backdrop-blur-sm"
        aria-label="Beri reaksi dan aksi"
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {REACTION_BUTTONS.map(({ type: t, emoji, label }) => {
            const isPressed = Boolean(reacted[t]);
            const count = item.reactions[t.toLowerCase()] ?? 0;

            return (
              <button
                key={t}
                onClick={() => react(t)}
                aria-pressed={isPressed}
                aria-label={`Beri reaksi ${label}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border select-none outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isPressed
                    ? 'border-primary/50 bg-primary/15 text-primary shadow-xs'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border'
                }`}
              >
                <span aria-hidden="true">{emoji}</span>
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
                <span>Tersalin</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Bagikan</span>
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
            <span className="hidden sm:inline">Laporkan</span>
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
          <span className="text-xs text-muted-foreground">Diskusi anonim & aman</span>
        </div>

        {/* Form Kirim Whisper */}
        <div className="rounded-xl border border-border/80 bg-card/80 p-4 space-y-3 shadow-sm">
          {replyTo ? (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs text-primary">
              <span className="flex items-center gap-1.5">
                <CornerDownRight className="h-3.5 w-3.5" />
                <span>
                  Membalas <strong>{replyTo.author}</strong> (Menyambung rantai percakapan)
                </span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-semibold ml-2 hover:underline text-foreground"
              >
                ✕ Batal
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
                    ? `Balas ${replyTo.author} secara anonim...`
                    : 'Kirim whisper anonim ke pengakuan ini...'
                }
                maxLength={300}
                className="flex-1 rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Tulis bisikan"
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
                    <span>{replyTo ? 'Balas' : 'Kirim'}</span>
                  </>
                )}
              </Button>
            </div>

            {/* Character count & Badges */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              {/* Badge picker */}
              {userBadges.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-[11px]">Gunakan lencana:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBadge('')}
                    className={`rounded-full px-2 py-0.5 border text-[10px] font-medium transition-colors ${
                      !selectedBadge
                        ? 'border-primary/50 bg-primary/20 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    Polos
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
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Semua bisikan dikirim secara anonim tanpa identitas wallet.
                </span>
              )}

              <span
                className={`font-mono text-[11px] ml-auto ${
                  whisper.length > 270 ? 'text-amber-400' : 'text-muted-foreground'
                }`}
              >
                {whisper.length}/300
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
