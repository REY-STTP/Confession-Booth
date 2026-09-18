'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// P2 #17: halaman error memakai design tokens (bukan class fiktif) + copy EN
// + tautan kembali (e2e: tetap role=alert).
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
    <div
      role="alert"
      className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm"
    >
      <h1 className="text-xl font-bold tracking-tight text-foreground">Something went wrong.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The booth stumbled. Nothing you wrote was lost on our side — please try again.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
        <Link
          href="/feed"
          className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to Feed
        </Link>
      </div>
    </div>
  );
}
