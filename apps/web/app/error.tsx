'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // T1-043: log digest saja (tanpa isi confession) untuk observability.
    // eslint-disable-next-line no-console
    console.error(`[booth-web] route error digest=${error?.digest ?? 'none'}`);
  }, [error]);
  return (
    <div className="booth-card p-10 text-center" role="alert">
      <h1 className="text-xl font-bold">Booth sempat goyah.</h1>
      <p className="mt-2 text-sm text-booth-dim">Terjadi kesalahan. Coba lagi.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-booth-accent px-6 py-3 font-semibold text-black">
        Coba lagi
      </button>
    </div>
  );
}
