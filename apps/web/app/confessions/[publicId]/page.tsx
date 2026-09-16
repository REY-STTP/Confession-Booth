'use client';

import { use, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { BoothCard } from '@/app/components/booth-card';
import { ReportModal } from '@/app/components/composer';
import {
  API_URL,
  type FeedItem,
  type WhisperItem,
  type UserBadgeItem,
  BADGE_META,
  getMyBadges,
  timeAgo,
} from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';

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
      setLoadError('Masuk booth dulu untuk memberi reaksi.');
      return;
    }
    const on = !reacted[type];
    setReacted((s) => ({ ...s, [type]: on }));
    try {
      const res = await apiFetch(
        `/api/confessions/${encodeURIComponent(publicId)}/reactions`,
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        },
      );
      if (!res.ok) throw new Error(`react failed: ${res.status}`);
    } catch {
      setReacted((s) => ({ ...s, [type]: !on }));
    }
  }

  async function sendWhisper(e: React.FormEvent) {
    e.preventDefault();
    if (!whisper.trim()) return;
    if (whisper.length > 300) {
      setLoadError('Whisper maksimal 300 karakter.');
      return;
    }
    if (/<[a-zA-Z/!]/.test(whisper)) {
      setLoadError('HTML tidak diizinkan di whisper.');
      return;
    }
    if (state !== 'booth' || !accessToken) {
      setLoadError('Masuk booth dulu untuk mengirim whisper.');
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
      setLoadError('');
    } catch {
      setLoadError('Whisper gagal terkirim. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const rootWhispers = whispers.filter((w) => !w.parentWhisperId);
  const getReplies = (parentId: string) => whispers.filter((w) => w.parentWhisperId === parentId);

  function renderWhisperNode(w: WhisperItem, isChild = false) {
    const replies = getReplies(w.id);
    const badgeMeta = w.badgeType ? BADGE_META[w.badgeType] : null;

    return (
      <div
        key={w.id}
        className={`${isChild ? 'mt-2.5 ml-3 md:ml-6 pl-3 border-l-2 border-booth-line/60' : ''}`}
      >
        <div className="booth-card p-4 transition-all hover:border-booth-line">
          <div className="flex items-center justify-between text-xs text-booth-dim flex-wrap gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-booth-ink">{w.author.displayName}</span>
              {w.isOp ? (
                <span
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-950/40 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300"
                  title="Original Poster (Pembuat Confession ini)"
                >
                  OP
                </span>
              ) : null}
              {badgeMeta ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] ${badgeMeta.color}`}
                  title={badgeMeta.desc}
                >
                  <span>{badgeMeta.icon}</span>
                  <span>{badgeMeta.label}</span>
                </span>
              ) : null}
            </div>
            <span>{timeAgo(w.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{w.content}</p>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-booth-line/30">
            <button
              type="button"
              onClick={() => {
                setReplyTo({ id: w.id, author: w.author.displayName });
                const el = document.getElementById('whisper-input');
                el?.focus();
              }}
              className="text-xs text-booth-dim hover:text-booth-accent transition-colors flex items-center gap-1"
            >
              ↩️ Balas di rantai ini
            </button>
            {replies.length > 0 ? (
              <span className="text-[11px] text-booth-dim font-mono">
                🧵 {replies.length} balasan
              </span>
            ) : null}
          </div>
        </div>
        {replies.length > 0 ? (
          <div className="space-y-2.5 mt-2">
            {replies.map((reply) => renderWhisperNode(reply, true))}
          </div>
        ) : null}
      </div>
    );
  }

  if (missing) return notFound();
  if (loadError && !item)
    return (
      <p role="alert" className="text-red-400">
        {loadError}
      </p>
    );
  if (!item)
    return (
      <p role="status" className="text-booth-dim">
        Memuat…
      </p>
    );

  return (
    <div className="space-y-6">
      <BoothCard item={item} />
      {loadError ? (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" aria-label="Beri reaksi">
        {['UNDERSTAND', 'LOVE', 'SAD', 'WILD', 'FUNNY'].map((t) => (
          <button
            key={t}
            onClick={() => react(t)}
            aria-pressed={!!reacted[t]}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              reacted[t]
                ? 'border-booth-accent bg-booth-accent/10 font-medium text-booth-ink'
                : 'border-booth-line text-booth-dim hover:text-booth-ink'
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setReportOpen(true)}
          className="rounded-full border border-booth-line px-3 py-1.5 text-sm text-booth-dim hover:text-booth-ink"
        >
          Report
        </button>
      </div>

      <section aria-label="Confession Chains & Whispers" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <span>🧵 Confession Chains ({whispers.length})</span>
          </h2>
          <span className="text-xs text-booth-dim">Diskusikan secara anonim</span>
        </div>

        {/* Form kirim whisper / balas berantai */}
        <div className="rounded-xl border border-booth-line/80 bg-booth-panel/80 p-3.5 space-y-2.5">
          {replyTo ? (
            <div className="flex items-center justify-between rounded-lg bg-booth-accent/10 border border-booth-accent/30 px-3 py-1.5 text-xs text-booth-accent">
              <span>
                ↩️ Membalas <strong>{replyTo.author}</strong> (Menyambung rantai percakapan)
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="hover:underline font-semibold ml-2 text-booth-ink"
              >
                ✕ Batal
              </button>
            </div>
          ) : null}

          <form className="flex flex-col gap-2.5" onSubmit={sendWhisper}>
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
                className="flex-1 rounded-lg border border-booth-line bg-booth-bg p-2.5 text-sm"
                aria-label="Whisper"
              />
              <button
                disabled={isSubmitting || !whisper.trim()}
                className="rounded-lg bg-booth-accent px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Mengirim…' : replyTo ? 'Balas' : 'Kirim'}
              </button>
            </div>

            {userBadges.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                <span className="text-booth-dim">Lencana:</span>
                <button
                  type="button"
                  onClick={() => setSelectedBadge('')}
                  className={`rounded-full px-2 py-0.5 border text-[11px] ${
                    !selectedBadge
                      ? 'border-booth-accent bg-booth-accent/20 text-booth-ink'
                      : 'border-booth-line text-booth-dim'
                  }`}
                >
                  Tanpa Lencana
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
                      className={`rounded-full px-2 py-0.5 border text-[11px] flex items-center gap-1 ${
                        isSel
                          ? `${meta.color} font-medium ring-1 ring-current`
                          : 'border-booth-line text-booth-dim'
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </form>
        </div>

        {/* Tree of whispers */}
        {whispers.length === 0 ? (
          <p className="text-sm text-booth-dim py-4 text-center">
            Belum ada whisper. Jadilah yang pertama memulai utas diskusi anonim ini.
          </p>
        ) : (
          <div className="space-y-3">{rootWhispers.map((w) => renderWhisperNode(w))}</div>
        )}
      </section>

      {reportOpen ? (
        <ReportModal targetId={item.publicId} onClose={() => setReportOpen(false)} />
      ) : null}
    </div>
  );
}
