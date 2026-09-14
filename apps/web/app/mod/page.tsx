'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { SkeletonList } from '@/app/components/booth-card';
import { API_URL } from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';

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
      const res = await apiFetch(`/api/moderation/queue?status=${encodeURIComponent(status)}&limit=20`, accessToken);
      if (res.status === 401) throw new Error('Sesi habis — masuk lagi.');
      if (res.status === 403) throw new Error('Butuh role MODERATOR/ADMIN.');
      if (!res.ok) throw new Error(`queue failed: ${res.status}`);
      const body = await res.json();
      setItems(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal muat antrean.');
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
      if (!res.ok) throw new Error(`action failed: ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aksi gagal.');
    } finally {
      setActing('');
    }
  }

  if (state !== 'booth') {
    return (
      <div className="booth-card p-5 text-sm">
        <p className="font-semibold">Moderation queue</p>
        <p className="mt-1 text-booth-dim">Masuk booth dulu dengan akun moderator. Identitas moderator tidak publik.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Moderation queue</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-booth-line bg-booth-bg p-2 text-sm"
          aria-label="Filter status"
        >
          {['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      {!items ? <SkeletonList /> : items.length === 0 ? (
        <p className="text-sm text-booth-dim">Antrean kosong.</p>
      ) : items.map((q) => (
        <div key={q.reportId} className="booth-card space-y-2 p-4 text-sm">
          <p className="font-semibold">{q.targetPublicId ?? '(target hilang)'} · {q.reason}</p>
          <p className="text-booth-dim">{q.preview ?? '—'}</p>
          <p className="text-xs text-booth-dim">Status target: {q.targetStatus ?? '?'} · {new Date(q.createdAt).toLocaleString()}</p>
          <div className="flex gap-2">
            <button
              disabled={acting !== ''}
              onClick={() => act(q.targetType, q.targetPublicId, 'DISMISS')}
              aria-label={`Dismiss ${q.targetPublicId}`}
              className="rounded-lg border border-booth-line px-3 py-1.5 disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              disabled={acting !== ''}
              onClick={() => act(q.targetType, q.targetPublicId, 'HIDE')}
              aria-label={`Hide ${q.targetPublicId}`}
              className="rounded-lg border border-booth-line px-3 py-1.5 disabled:opacity-50"
            >
              Hide
            </button>
            <button
              disabled={acting !== ''}
              onClick={() => act(q.targetType, q.targetPublicId, 'REMOVE')}
              aria-label={`Remove ${q.targetPublicId}`}
              className="rounded-lg border border-red-800 px-3 py-1.5 text-red-300 disabled:opacity-50"
            >
              {acting ? '…' : 'Remove'}
            </button>
          </div>
        </div>
      ))}
      <p className="text-xs text-booth-dim">Semua aksi tercatat: actor, reason, timestamp, target, policy version. Identitas moderator tidak publik.</p>
    </div>
  );
}

export default function ModPage() {
  return (
    <Suspense fallback={<SkeletonList />}>
      <ModInner />
    </Suspense>
  );
}
