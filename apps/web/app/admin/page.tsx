'use client';

import { useEffect, useState } from 'react';
import { CATEGORIES, API_URL } from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';

/** T1-034: admin config nyata — health chain + kategori seed + policy version. */
export default function AdminPage() {
  const { accessToken, state } = useSession();
  const [chain, setChain] = useState<{ chainId?: string; contractConfigured?: boolean } | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/health/chain`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`chain health failed: ${res.status}`);
        const body = await res.json();
        if (!cancelled) setChain(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Health gagal.');
      }
      if (state === 'booth' && accessToken) {
        try {
          const q = await apiFetch('/api/moderation/queue?status=OPEN&limit=1', accessToken);
          if (q.ok) {
            const b = await q.json();
            if (!cancelled) setQueueCount((b.items ?? []).length);
          }
        } catch {
          // non-fatal untuk admin view
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, state]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Admin</h1>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <div className="booth-card p-5 text-sm">
        <p className="font-semibold">Kategori ({CATEGORIES.length})</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <span key={c} className="rounded-full border border-booth-line px-2.5 py-1 text-booth-dim">{c} · aktif</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-booth-dim">Kelola aktif/nonaktif + sort_order via DB seed (UI kelola penuh di 1.5).</p>
      </div>
      <div className="booth-card p-5 text-sm">
        <p className="font-semibold">Policy version</p>
        <p className="mt-1 text-booth-dim">guidelines v1.0 · privacy v1.0 (dipakai `policy_version` di T1-015)</p>
      </div>
      <div className="booth-card p-5 text-sm">
        <p className="font-semibold">Chain health</p>
        {!chain ? (
          <p className="mt-1 text-booth-dim">Memuat…</p>
        ) : (
          <p className="mt-1 text-booth-dim">
            chainId {chain.chainId} · contract {chain.contractConfigured ? 'configured' : 'belum di-set'} (tanpa secret)
          </p>
        )}
        {queueCount !== null ? <p className="mt-1 text-booth-dim">Antrean OPEN (sampel): {queueCount}</p> : null}
      </div>
    </div>
  );
}
