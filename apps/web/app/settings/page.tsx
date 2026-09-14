'use client';

import { useSession } from '@/lib/session';

/** T1-031: session nyata — visitor browse bebas, kontributor sign via wallet. */
export default function SettingsPage() {
  const { state, error, enter, logout } = useSession();
  const busy = state === 'connecting' || state === 'signing';
  return (
    <div className="booth-card space-y-4 p-6">
      <h1 className="text-xl font-bold">Session</h1>
      <p className="text-sm text-booth-dim">
        Status:{' '}
        {state === 'visitor'
          ? 'Visitor (tanpa wallet)'
          : state === 'connecting'
            ? 'Menghubungkan wallet…'
            : state === 'signing'
              ? 'Menunggu signature…'
              : 'Di dalam booth (sesi aktif) Burr.'}{' '}
        Wallet hanya diminta saat aksi yang butuh otorisasi. Token hanya di memori, tidak di localStorage.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {state === 'booth' ? (
        <button onClick={logout} className="w-full rounded-xl border border-booth-line px-4 py-3">
          Keluar dari booth (revoke)
        </button>
      ) : (
        <button
          onClick={enter}
          disabled={busy}
          className="w-full rounded-xl bg-booth-accent px-4 py-3 font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Menghubungkan…' : 'Enter the Booth'}
        </button>
      )}
      <div className="rounded-lg border border-booth-line p-4 text-xs leading-relaxed text-booth-dim">
        <p className="font-semibold text-booth-ink">Privacy Notice</p>
        <p className="mt-1">
          Confession publik, profil tidak harus. Blockchain dan metadata jaringan tetap bisa menimbulkan risiko
          privasi. Jangan tulis info pengenal. Sesi kedaluwarsa otomatis; logout mencabut token.
        </p>
      </div>
    </div>
  );
}
