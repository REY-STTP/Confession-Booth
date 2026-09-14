'use client';

import { use, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { BoothCard } from '@/app/components/booth-card';
import { ReportModal } from '@/app/components/composer';
import { API_URL, type FeedItem } from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';

/** T1-032: detail nyata — reaksi/whisper authed, rollback saat gagal, tanpa fallback salah. */
export default function DetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  const { accessToken, state } = useSession();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [whispers, setWhispers] = useState<Array<{ id: string; author: { displayName: string }; content: string }>>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reacted, setReacted] = useState<Record<string, boolean>>({});
  const [whisper, setWhisper] = useState('');
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/confessions/${encodeURIComponent(publicId)}`, { cache: 'no-store' });
        if (res.status === 404) {
          if (!cancelled) setMissing(true);
          return;
        }
        if (!res.ok) throw new Error(`detail failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        // T1-032 AC: pastikan tidak ada wallet sebagai nama penulis.
        if (typeof data?.author?.displayName === 'string' && /^0x[a-fA-F0-9]{40}$/.test(data.author.displayName)) {
          if (!cancelled) setLoadError('Respons invalid (identitas bocor).');
          return;
        }
        setItem(data);
        try {
          const w = await fetch(`${API_URL}/api/confessions/${encodeURIComponent(publicId)}/whispers`).then((r) => {
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

  async function react(type: string) {
    if (state !== 'booth' || !accessToken) {
      setLoadError('Masuk booth dulu untuk memberi reaksi.');
      return;
    }
    const on = !reacted[type];
    setReacted((s) => ({ ...s, [type]: on }));
    try {
      const res = await apiFetch(`/api/confessions/${encodeURIComponent(publicId)}/reactions`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error(`react failed: ${res.status}`);
    } catch {
      setReacted((s) => ({ ...s, [type]: !on }));
    }
  }

  if (missing) return notFound();
  if (loadError && !item) return <p role="alert" className="text-red-400">{loadError}</p>;
  if (!item) return <p role="status" className="text-booth-dim">Memuat…</p>;

  return (
    <div className="space-y-6">
      <BoothCard item={item} />
      {loadError ? <p role="alert" className="text-sm text-red-400">{loadError}</p> : null}
      <div className="flex flex-wrap gap-2" aria-label="Beri reaksi">
        {['UNDERSTAND', 'LOVE', 'SAD', 'WILD', 'FUNNY'].map((t) => (
          <button
            key={t}
            onClick={() => react(t)}
            aria-pressed={!!reacted[t]}
            className={`rounded-full border px-3 py-1.5 text-sm ${reacted[t] ? 'border-booth-accent' : 'border-booth-line text-booth-dim'}`}
          >
            {t}
          </button>
        ))}
        <button onClick={() => setReportOpen(true)} className="rounded-full border border-booth-line px-3 py-1.5 text-sm text-booth-dim">
          Report
        </button>
      </div>

      <section aria-label="Whisper thread" className="space-y-3">
        <h2 className="font-semibold">Leave a whisper</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
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
              setLoadError('Masuk booth dulu untuk whisper.');
              return;
            }
            const content = whisper;
            try {
              const res = await apiFetch(`/api/confessions/${encodeURIComponent(publicId)}/whispers`, accessToken, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
              });
              if (!res.ok) throw new Error(`whisper failed: ${res.status}`);
              const created = await res.json().catch(() => null);
              setWhispers((w) => [...w, { id: created?.id ?? `local-${Date.now()}`, author: { displayName: 'Anonymous #0000' }, content }]);
              setWhisper('');
            } catch {
              setLoadError('Whisper gagal terkirim. Coba lagi.');
            }
          }}
        >
          <input
            value={whisper}
            onChange={(e) => setWhisper(e.target.value)}
            placeholder="Say something anonymously..."
            maxLength={300}
            className="flex-1 rounded-lg border border-booth-line bg-booth-panel p-2.5 text-sm"
            aria-label="Whisper"
          />
          <button className="rounded-lg bg-booth-accent px-4 text-sm font-semibold text-black">Kirim</button>
        </form>
        {whispers.length === 0 ? (
          <p className="text-sm text-booth-dim">Belum ada whisper. Jadilah yang pertama.</p>
        ) : (
          whispers.map((w) => (
            <div key={w.id} className="booth-card p-4">
              <p className="text-xs text-booth-dim">{w.author.displayName}</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{w.content}</p>
            </div>
          ))
        )}
      </section>

      {reportOpen ? <ReportModal targetId={item.publicId} onClose={() => setReportOpen(false)} /> : null}
    </div>
  );
}
