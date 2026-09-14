import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Confession Booth — Say what you can\u2019t say',
  description: 'Anonymous confession feed. Your confession is public. Your profile doesn\u2019t have to be.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black"
        >
          Lewati ke konten
        </a>
        <header className="border-b border-booth-line">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4" aria-label="Utama">
            <a href="/" className="text-lg font-semibold tracking-wide">
              🕯️ Confession Booth
            </a>
            <div className="flex gap-4 text-sm text-booth-dim">
              <a className="hover:text-booth-ink" href="/feed">Feed</a>
              <a className="hover:text-booth-ink" href="/trending">Trending</a>
              <a className="hover:text-booth-ink" href="/midnight">Midnight</a>
              <a className="hover:text-booth-ink" href="/compose">Confess</a>
            </div>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-3xl px-4 pb-24 pt-8">
          <SessionProvider>{children}</SessionProvider>
        </main>
        <footer className="border-t border-booth-line">
          <div className="mx-auto max-w-3xl px-4 py-6 text-xs leading-relaxed text-booth-dim">
            <p>
              Your confession is public. Your profile doesn&rsquo;t have to be. Blockchain and
              network metadata can still create privacy risks.
            </p>
            <p className="mt-2 flex gap-4">
              <a className="underline" href="/privacy">Privacy</a>
              <a className="underline" href="/guidelines">Guidelines</a>
              <a className="underline" href="/settings">Session</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
