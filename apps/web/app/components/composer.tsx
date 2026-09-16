'use client';

import { useEffect, useState } from 'react';
import { countChars, API_URL } from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';
import {
  deriveAnonymousIdentityBrowser,
  getMerkleProofBrowser,
  canonicalHashBrowser,
  createAnonymousSignalProofBrowser,
  getCurrentEpoch,
} from '@/lib/zk';

const CATS = [
  'love',
  'heartbreak',
  'secret',
  'life',
  'school',
  'work',
  'family',
  'funny',
  'sad',
  'deep',
  'midnight',
];

/** Composer nyata T1-032 / Fase 2 ZK Stealth — auth wajib, idempotency UUID, render plaintext. */
export function ComposerForm() {
  const { accessToken, state, getOrRequestSignature } = useSession();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('sad');
  const [privacyMode, setPrivacyMode] = useState<'standard' | 'zk'>('standard');
  const [zkStep, setZkStep] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'visible' | 'error'>('idle');
  const [error, setError] = useState('');
  const [publicId, setPublicId] = useState('');
  const [publishedProofType, setPublishedProofType] = useState('SESSION');

  const n = countChars(content);
  const markup = /<[a-zA-Z/!]/.test(content);

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // T1-032: blokir paste HTML kaya — tempel sebagai teks biasa.
    // T1-026: normalize unicode (NFC) + strip control chars
    e.preventDefault();
    const raw = e.clipboardData.getData('text/plain').slice(0, 500);
    // Normalize to NFC, strip control chars (keep \n\t)
    const text = raw
      .normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    const el = e.currentTarget;
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    setContent((content.slice(0, start) + text + content.slice(end)).slice(0, 500));
  }

  async function solvePowBrowser(salt: string, difficulty: number): Promise<string | null> {
    // T1H-005: Gunakan Web Worker untuk non-blocking PoW dengan timeout 30s
    return new Promise<string | null>((resolve) => {
      const worker = new Worker('/pow-worker.js');
      const timeoutMs = 30000;
      const timer = setTimeout(() => {
        worker.terminate();
        resolve(null);
      }, timeoutMs + 1000); // slight buffer

      worker.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data.nonce);
        worker.terminate();
      };
      worker.onerror = () => {
        clearTimeout(timer);
        resolve(null);
        worker.terminate();
      };
      worker.postMessage({ salt, difficulty, timeoutMs });
    });
  }

  async function postConfession(idemKey: string, pow?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Idempotency-Key': idemKey,
    };
    if (pow) headers['x-pow-solution'] = pow;
    return apiFetch('/api/confessions', accessToken, {
      method: 'POST',
      headers,
      body: JSON.stringify({ category, content }),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (state !== 'booth' || !accessToken) {
      setStatus('error');
      setError('Masuk booth dulu (Enter the Booth) untuk publish.');
      return;
    }
    if (n < 1) return (setError('Tulis dulu pengakuanmu (min 1 karakter).'), setStatus('error'));
    if (n > 500) return (setError('Maksimal 500 karakter.'), setStatus('error'));
    if (markup) return (setError('HTML tidak diizinkan — tulis teks biasa.'), setStatus('error'));
    setStatus('pending');
    setZkStep('');
    try {
      const idemKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      let res: Response;

      if (privacyMode === 'zk') {
        setZkStep('Menghubungkan kunci identitas kriptografis…');
        const sig = await getOrRequestSignature();
        const identity = await deriveAnonymousIdentityBrowser(sig);

        setZkStep('Memeriksa status Merkle Tree pool anonim…');
        let rootRes = await fetch(`${API_URL}/api/zk/merkle-root`);
        if (!rootRes.ok) throw new Error('Gagal menghubungi endpoint ZK Merkle root.');
        let rootData = await rootRes.json();
        let commitments: string[] = rootData.commitments ?? [];

        let leafIndex = commitments.indexOf(identity.commitment);
        if (leafIndex < 0) {
          setZkStep('Mendaftarkan komitmen identitas ke Merkle tree…');
          const regRes = await fetch(`${API_URL}/api/zk/register-commitment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ commitment: identity.commitment }),
          });
          if (!regRes.ok) {
            const b = await regRes.json().catch(() => ({}));
            throw new Error(b?.error?.message ?? 'Gagal mendaftarkan komitmen identitas.');
          }
          rootRes = await fetch(`${API_URL}/api/zk/merkle-root`);
          rootData = await rootRes.json();
          commitments = rootData.commitments ?? [];
          leafIndex = commitments.indexOf(identity.commitment);
        }

        setZkStep('Membangkitkan Zero-Knowledge Proof di browser…');
        const merkleProof = await getMerkleProofBrowser(commitments, leafIndex);
        const contentHash = await canonicalHashBrowser(content);
        const epoch = getCurrentEpoch();
        const zkProof = await createAnonymousSignalProofBrowser({
          identity,
          merkleProof,
          signal: contentHash,
          epoch,
          scope: 'confess',
        });

        setZkStep('Menerbitkan secara unlinkable (tanpa token sesi)…');
        res = await fetch(`${API_URL}/api/confessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idemKey,
          },
          body: JSON.stringify({ category, content, zkProof }),
        });
      } else {
        res = await postConfession(idemKey);
        // T1H-005: jawab tantangan PoW sekali lalu retry (tanpa provider eksternal).
        if (res.status === 429) {
          const b = await res.json().catch(() => ({}));
          const ch = b?.error?.challenge as { token?: string; difficulty?: number } | undefined;
          if (b?.error?.code === 'POW_REQUIRED' && ch?.token && typeof ch.difficulty === 'number') {
            setError('Aktivitas tinggi — menyelesaikan proof-of-work…');
            const salt = ch.token.split('.')[0];
            const nonceN = await solvePowBrowser(salt, ch.difficulty);
            if (nonceN === null)
              throw new Error('POW_FAILED — perangkat terlalu lambat, coba lagi.');
            res = await postConfession(idemKey, `${ch.token}:${nonceN}`);
          }
        }
      }

      if (res.status === 401) throw new Error('UNAUTHORIZED — sesi habis, masuk lagi.');
      if (res.status === 429) {
        const b = await res.json().catch(() => ({}));
        throw new Error(
          b?.error?.message ??
            'RATE_LIMITED — batas pengiriman tercapai untuk epoch ini (coba 1 jam lagi).',
        );
      }
      if (res.status === 409) throw new Error('CONTENT_DUPLICATE — sudah pernah publish ini.');
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.code ?? b?.error?.message ?? 'PUBLISH_FAILED');
      }
      const body = await res.json();
      setPublicId(body.publicId ?? body.id ?? '');
      setPublishedProofType(body.proofType ?? (privacyMode === 'zk' ? 'ZK' : 'SESSION'));
      setStatus('visible');
    } catch (err) {
      setError(
        err instanceof Error ? `Gagal terbit (${err.message}).` : 'Gagal terbit. Coba lagi.',
      );
      setStatus('error');
    }
  }

  return (
    <form onSubmit={submit} className="booth-card space-y-4 p-5" aria-label="Composer">
      <h2 className="text-lg font-semibold">What do you need to get off your chest?</h2>

      <div className="rounded-lg border border-booth-line bg-booth-bg/40 p-3.5">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-booth-dim">
          Mode Privasi (Fase 2)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPrivacyMode('standard')}
            className={`rounded-lg border p-2.5 text-left text-xs transition ${
              privacyMode === 'standard'
                ? 'border-booth-accent bg-booth-accent/15 font-semibold text-booth-ink shadow-sm'
                : 'border-booth-line text-booth-dim hover:text-booth-ink hover:bg-booth-bg'
            }`}
          >
            <span className="block font-medium">🔘 Standard Anonymous</span>
            <span className="mt-0.5 block text-[11px] opacity-80">
              Sesi terautentikasi, nama Anonymous #NNNN
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPrivacyMode('zk')}
            className={`rounded-lg border p-2.5 text-left text-xs transition ${
              privacyMode === 'zk'
                ? 'border-emerald-500 bg-emerald-950/50 font-semibold text-emerald-400 shadow-sm'
                : 'border-booth-line text-booth-dim hover:text-booth-ink hover:bg-booth-bg'
            }`}
          >
            <span className="block font-medium">🛡️ ZK Stealth Mode</span>
            <span className="mt-0.5 block text-[11px] opacity-80">
              Zero-knowledge proof, unlinkable
            </span>
          </button>
        </div>
        {privacyMode === 'zk' ? (
          <p className="mt-2.5 rounded border border-emerald-800/40 bg-emerald-950/30 p-2 text-[11px] leading-relaxed text-emerald-300">
            🛡️ <strong>Zero-Knowledge Stealth:</strong> Bukti keanggotaan digenerate langsung di
            browser via Merkle Tree & Epoch Nullifier. Request dikirim <em>tanpa token sesi</em> —
            identitas wallet Anda tidak pernah terhubung dengan pengakuan ini di database maupun
            blockchain.
          </p>
        ) : null}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-booth-dim">Kategori (pilih satu)</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-booth-line bg-booth-bg p-2.5"
        >
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="sr-only">Confession</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={onPaste}
          placeholder="Write your confession..."
          rows={5}
          maxLength={500}
          className="w-full rounded-lg border border-booth-line bg-booth-bg p-3"
          aria-describedby="counter privacy-warn"
        />
      </label>
      <div className="flex items-center justify-between text-xs">
        <span
          id="counter"
          className={n > 500 ? 'text-red-400' : 'text-booth-dim'}
          aria-live="polite"
        >
          {n}/500
        </span>
        <span id="privacy-warn" className="text-booth-dim">
          Jangan tulis nama, alamat, atau info yang mengidentifikasimu.
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {status === 'pending' ? (
        <p role="status" className="text-sm text-booth-dim">
          {zkStep ? `⏳ ${zkStep}` : 'Mempublikasikan… (menunggu konfirmasi)'}
        </p>
      ) : null}
      {status === 'visible' ? (
        <div
          role="status"
          className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-200"
        >
          <p>
            {publishedProofType === 'ZK' ? (
              <>
                🛡️ Pengakuanmu terbit secara <strong>Zero-Knowledge Anonymous (Unlinkable)</strong>.
                Tidak ada alamat wallet atau data sesi yang tercatat!
              </>
            ) : (
              <>
                Pengakuanmu terbit sebagai <strong>Anonymous</strong>. Tidak ada profil/wallet yang
                ditampilkan.
              </>
            )}
          </p>
          {publicId ? (
            <p className="mt-1">
              <a className="underline" href={`/confessions/${encodeURIComponent(publicId)}`}>
                Lihat confession →
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={status === 'pending'}
        className={`w-full rounded-xl px-4 py-3 font-semibold text-black transition disabled:opacity-50 ${
          privacyMode === 'zk' ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-booth-accent'
        }`}
      >
        {status === 'pending'
          ? 'Mempublikasikan…'
          : privacyMode === 'zk'
            ? 'Confess (ZK Stealth)'
            : 'Confess'}
      </button>
    </form>
  );
}

/** Modal report mock — 11 reason sesuai MODERATION.md. */
export function ReportModal({ onClose, targetId }: { onClose: () => void; targetId?: string }) {
  const reasons = [
    'SPAM',
    'HARASSMENT',
    'HATE',
    'THREAT',
    'DOXXING',
    'SEXUAL_EXPLOITATION',
    'SELF_HARM',
    'FRAUD',
    'MALWARE',
    'ILLEGAL_ACTIVITY',
    'OTHER',
  ];
  const [reason, setReason] = useState('SPAM');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useState(() => ({ current: null as HTMLDivElement | null }))[0];
  const prevFocus = useState(() => ({ current: null as Element | null }))[0];

  // T1-043: focus-trap ringan + Escape + return-focus + initial-focus.
  useEffect(() => {
    prevFocus.current = document.activeElement;
    const box = boxRef.current;
    const sel = box?.querySelector<HTMLElement>('select, button');
    sel?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>('select, button, [href]')).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose, boxRef, prevFocus]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Report"
    >
      <div ref={boxRef} className="booth-card w-full max-w-md p-5">
        {!done ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              if (!targetId) {
                setError('Target report tidak valid (mock).');
                return;
              }
              try {
                const res = await fetch(`${API_URL}/api/reports`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ targetType: 'CONFESSION', targetId, reason }),
                });
                if (!res.ok)
                  throw new Error(
                    (await res.json().catch(() => ({})))?.error?.code ?? 'REPORT_FAILED',
                  );
                setDone(true);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? `Gagal kirim report (${err.message}).`
                    : 'Gagal kirim report.',
                );
              }
            }}
          >
            <h3 className="font-semibold">Something wrong?</h3>
            <p className="mt-1 text-sm text-booth-dim">
              Report this confession and our moderation team will review it.
            </p>
            {error ? (
              <p role="alert" className="mt-2 text-sm text-red-400">
                {error}
              </p>
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-booth-dim">Alasan</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-booth-line bg-booth-bg p-2.5"
              >
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-booth-line px-4 py-2"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-booth-accent px-4 py-2 font-semibold text-black"
              >
                Kirim report
              </button>
            </div>
          </form>
        ) : (
          <div role="status">
            <p className="font-semibold">Report terkirim.</p>
            <p className="mt-1 text-sm text-booth-dim">
              Tim moderasi akan meninjau. Identitas pelapor tidak dipublikasikan.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-lg border border-booth-line px-4 py-2"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
