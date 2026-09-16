'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  AlertTriangle,
  Loader2,
  Check,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  countChars,
  API_URL,
  getRooms,
  getMyBadges,
  BADGE_META,
  type RoomItem,
  type UserBadgeItem,
} from '@/lib/booth';
import { useSession, apiFetch } from '@/lib/session';
import {
  deriveAnonymousIdentityBrowser,
  getMerkleProofBrowser,
  canonicalHashBrowser,
  createAnonymousSignalProofBrowser,
  getCurrentEpoch,
} from '@/lib/zk';
import { ZkStepper } from '@/components/zk-stepper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ReportDialog } from '@/components/report-dialog';

const EMOTION_CATEGORIES = [
  { value: 'sad', label: 'Sad', icon: '🌧️' },
  { value: 'heartbreak', label: 'Heartbreak', icon: '💔' },
  { value: 'secret', label: 'Secret', icon: '🤫' },
  { value: 'deep', label: 'Deep', icon: '🌊' },
  { value: 'love', label: 'Love', icon: '💌' },
  { value: 'life', label: 'Life', icon: '🌱' },
  { value: 'work', label: 'Work', icon: '💼' },
  { value: 'school', label: 'School', icon: '📚' },
  { value: 'family', label: 'Family', icon: '🏠' },
  { value: 'funny', label: 'Funny', icon: '😂' },
  { value: 'midnight', label: 'Midnight', icon: '🌒' },
] as const;

/** Composer nyata T1-032 / Fase 2 ZK Stealth — auth wajib, idempotency UUID, render plaintext. */
export function ComposerForm() {
  const { accessToken, state, getOrRequestSignature } = useSession();
  const [content, setContent] = React.useState('');
  const [category, setCategory] = React.useState('sad');
  const [rooms, setRooms] = React.useState<RoomItem[]>([]);
  const [selectedRoom, setSelectedRoom] = React.useState('');
  const [badges, setBadges] = React.useState<UserBadgeItem[]>([]);
  const [selectedBadge, setSelectedBadge] = React.useState('');
  const [privacyMode, setPrivacyMode] = React.useState<'standard' | 'zk'>('standard');
  const [zkStep, setZkStep] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'pending' | 'visible' | 'error'>('idle');
  const [error, setError] = React.useState('');
  const [publicId, setPublicId] = React.useState('');
  const [publishedProofType, setPublishedProofType] = React.useState('SESSION');

  React.useEffect(() => {
    getRooms()
      .then(setRooms)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (accessToken) {
      getMyBadges(accessToken)
        .then(setBadges)
        .catch(() => {});
    } else {
      setBadges([]);
    }
  }, [accessToken]);

  const n = countChars(content);
  const markup = /<[a-zA-Z/!]/.test(content);

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // T1-032: blokir paste HTML kaya — tempel sebagai teks biasa.
    // T1-026: normalize unicode (NFC) + strip control chars
    e.preventDefault();
    const raw = e.clipboardData.getData('text/plain').slice(0, 500);
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
      }, timeoutMs + 1000);

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
      body: JSON.stringify({
        category,
        content,
        roomSlug: selectedRoom || undefined,
        badgeType: selectedBadge || undefined,
      }),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (state !== 'booth' || !accessToken) {
      setStatus('error');
      const msg = 'Masuk booth dulu (Enter the Booth) untuk publish.';
      setError(msg);
      toast.error('Belum masuk booth', { description: msg });
      return;
    }
    if (n < 1) {
      setError('Tulis dulu pengakuanmu (min 1 karakter).');
      setStatus('error');
      return;
    }
    if (n > 500) {
      setError('Maksimal 500 karakter.');
      setStatus('error');
      return;
    }
    if (markup) {
      setError('HTML tidak diizinkan — tulis teks biasa.');
      setStatus('error');
      return;
    }

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
          body: JSON.stringify({
            category,
            content,
            roomSlug: selectedRoom || undefined,
            badgeType: selectedBadge || undefined,
            zkProof,
          }),
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
            if (nonceN === null) {
              throw new Error('POW_FAILED — komputasi perangkat terlalu lambat, coba lagi.');
            }
            res = await postConfession(idemKey, `${ch.token}:${nonceN}`);
          }
        }
      }

      if (res.status === 401) throw new Error('Sesi kedaluwarsa, silakan masuk booth kembali.');
      if (res.status === 429) {
        const b = await res.json().catch(() => ({}));
        throw new Error(
          b?.error?.message ??
            'Batas pengiriman tercapai untuk epoch saat ini. Silakan coba lagi nanti.',
        );
      }
      if (res.status === 409)
        throw new Error('Pengakuan dengan isi yang sama sudah pernah diterbitkan.');
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.code ?? b?.error?.message ?? 'Gagal mempublikasikan pengakuan.');
      }

      const body = await res.json();
      setPublicId(body.publicId ?? body.id ?? '');
      setPublishedProofType(body.proofType ?? (privacyMode === 'zk' ? 'ZK' : 'SESSION'));
      setStatus('visible');
      toast.success('Pengakuan berhasil diterbitkan ke suaka!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal terbit. Coba lagi.';
      setError(msg);
      setStatus('error');
      toast.error('Gagal menerbitkan', { description: msg });
    }
  }

  function handleReset() {
    setContent('');
    setStatus('idle');
    setError('');
    setPublicId('');
  }

  return (
    <div className="space-y-6">
      {/* ZK Stepper Modal */}
      <ZkStepper open={status === 'pending' && privacyMode === 'zk'} currentStatus={zkStep} />

      {/* Success State Banner */}
      {status === 'visible' ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-card p-6 sm:p-8 text-center space-y-4 shadow-lg backdrop-blur-md"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 shadow-inner">
            <Check className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Pengakuan Berhasil Diterbitkan
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              {publishedProofType === 'ZK' ? (
                <>
                  Pengakuanmu terlindungi oleh <strong>Zero-Knowledge Anonymous Stealth</strong>.
                  Tidak ada alamat wallet atau data sesi yang tertaut di database maupun blockchain.
                </>
              ) : (
                <>
                  Pengakuanmu terbit secara <strong>Anonim</strong>. Identitas wallet Anda tidak
                  pernah ditampilkan kepada publik.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {publicId ? (
              <Link href={`/confessions/${encodeURIComponent(publicId)}`}>
                <Button className="rounded-full gap-1.5 font-medium">
                  <span>Lihat Pengakuan</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
            <Button variant="outline" onClick={handleReset} className="rounded-full">
              Tulis Lagi
            </Button>
          </div>
        </div>
      ) : null}

      {/* Main Composer Card Form */}
      {status !== 'visible' ? (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-border/80 bg-card/85 p-5 sm:p-7 space-y-6 shadow-sm backdrop-blur-sm"
          aria-label="Composer"
        >
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              What do you need to get off your chest?
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Tuliskan rahasia atau rasa yang terpendam. Suaka ini aman, tenang, dan tanpa
              penghakiman.
            </p>
          </div>

          {/* Privacy Mode Selector */}
          <div className="rounded-xl border border-border/70 bg-background/50 p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tingkat Kerahasiaan (Privacy Mode)
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {privacyMode === 'zk' ? 'Max Stealth' : 'Standard'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Standard Anonymous Button */}
              <button
                type="button"
                onClick={() => setPrivacyMode('standard')}
                className={cn(
                  'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
                  privacyMode === 'standard'
                    ? 'border-primary/50 bg-primary/10 shadow-xs'
                    : 'border-border/60 bg-card/40 hover:border-border hover:bg-card/70',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lock
                    className={cn(
                      'h-4 w-4',
                      privacyMode === 'standard' ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      privacyMode === 'standard' ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Standard Anonymous
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Cepat dan terotentikasi via sesi SIWE. Nama publik muncul sebagai Anonymous #NNNN.
                </p>
              </button>

              {/* ZK Stealth Button */}
              <button
                type="button"
                onClick={() => setPrivacyMode('zk')}
                className={cn(
                  'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
                  privacyMode === 'zk'
                    ? 'border-emerald-500/60 bg-emerald-500/10 shadow-xs'
                    : 'border-border/60 bg-card/40 hover:border-border hover:bg-card/70',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck
                    className={cn(
                      'h-4 w-4',
                      privacyMode === 'zk' ? 'text-emerald-400' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      privacyMode === 'zk' ? 'text-emerald-300' : 'text-muted-foreground',
                    )}
                  >
                    ZK Stealth Mode
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Kriptografis Zero-Knowledge. Unlinkable — tanpa jejak wallet di database maupun
                  blockchain.
                </p>
              </button>
            </div>

            {privacyMode === 'zk' ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-2.5 text-[11px] text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                <p className="leading-relaxed">
                  <strong>Zero-Knowledge Stealth:</strong> Bukti keanggotaan digenerate di browser
                  via Merkle Tree & Nullifier. Permintaan dikirim <em>tanpa token sesi</em> untuk
                  privasi matematis mutlak.
                </p>
              </div>
            ) : null}
          </div>

          {/* Emotion Category Pills */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Pilih Nuansa Emosi
            </label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {EMOTION_CATEGORIES.map((c) => {
                const isSelected = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setCategory(c.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 border select-none',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room & Badge Picker Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Room Selector */}
            <div className="space-y-1.5">
              <label
                htmlFor="room-select"
                className="text-xs font-medium text-muted-foreground block"
              >
                Kamar Komunitas (Opsional)
              </label>
              <select
                id="room-select"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Beranda Umum (Tanpa Kamar)</option>
                {rooms.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.icon} {r.name} (#{r.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Badges Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>Lencana Reputasi (Opsional)</span>
                <span className="text-[11px] opacity-70">
                  {badges.length > 0 ? `${badges.length} dimiliki` : 'Belum ada'}
                </span>
              </label>

              {badges.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedBadge('')}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs border transition-colors',
                      !selectedBadge
                        ? 'border-primary/50 bg-primary/20 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-border/80',
                    )}
                  >
                    Polos
                  </button>
                  {badges.map((b) => {
                    const meta = BADGE_META[b.type] ?? {
                      label: b.type,
                      icon: '🏅',
                      color: 'border-border text-foreground',
                    };
                    const isSelected = selectedBadge === b.type;
                    return (
                      <button
                        key={b.type}
                        type="button"
                        onClick={() => setSelectedBadge(isSelected ? '' : b.type)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs border transition-all flex items-center gap-1',
                          isSelected
                            ? `${meta.color} font-semibold ring-1 ring-current`
                            : 'border-border text-muted-foreground hover:border-border/80',
                        )}
                        title={meta.desc}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-background/40 p-2.5 text-[11px] text-muted-foreground">
                  Dapatkan lencana dengan aktif mendengarkan di jam malam atau menyambung rantai
                  bisikan.
                </div>
              )}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-2">
            <label
              htmlFor="confession-text"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block"
            >
              Isi Pengakuan
            </label>
            <div className="relative">
              <Textarea
                id="confession-text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={onPaste}
                placeholder="Write your confession..."
                rows={6}
                maxLength={500}
                className="w-full resize-y rounded-xl border-border/80 bg-background/80 p-4 text-sm sm:text-base leading-relaxed placeholder:text-muted-foreground focus-visible:ring-primary font-sans"
                aria-describedby="counter privacy-warn"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span
                id="counter"
                className={cn(
                  'font-mono text-xs font-medium',
                  n > 480
                    ? 'text-destructive font-bold'
                    : n > 400
                      ? 'text-amber-400'
                      : 'text-muted-foreground',
                )}
                aria-live="polite"
              >
                {n}/500
              </span>
              <span
                id="privacy-warn"
                className="text-[11px] text-muted-foreground hidden xs:inline"
              >
                Jangan tulis nama, alamat, atau info yang mengidentifikasimu.
              </span>
            </div>
          </div>

          {/* Error message */}
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={status === 'pending'}
            size="lg"
            className={cn(
              'w-full rounded-full py-6 font-semibold text-sm sm:text-base transition-all duration-200 shadow-md',
              privacyMode === 'zk'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/30'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground',
            )}
          >
            {status === 'pending' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>{zkStep || 'Mempublikasikan...'}</span>
              </>
            ) : (
              <span>{privacyMode === 'zk' ? 'Confess (ZK Stealth)' : 'Confess'}</span>
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/** Modal report mock backward compatibility — forwards to modern ReportDialog */
export function ReportModal({ onClose, targetId }: { onClose: () => void; targetId?: string }) {
  return (
    <ReportDialog
      open={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      targetId={targetId ?? ''}
      targetType="CONFESSION"
    />
  );
}
