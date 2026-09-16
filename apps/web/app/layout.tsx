import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/session';
import { HeaderNav } from '@/app/components/header-nav';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b10',
};

export const metadata: Metadata = {
  title: {
    template: '%s | Confession Booth',
    default: 'Confession Booth — Say what you can’t say',
  },
  description:
    'Anonymous confession feed. Your confession is public. Your profile doesn’t have to be.',
  openGraph: {
    title: 'Confession Booth — Say what you can’t say',
    description:
      'Anonymous confession feed. Your confession is public. Your profile doesn’t have to be.',
    type: 'website',
    locale: 'id_ID',
    siteName: 'Confession Booth',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Confession Booth — Say what you can’t say',
    description:
      'Anonymous confession feed. Your confession is public. Your profile doesn’t have to be.',
  },
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
        <HeaderNav />
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
              <a className="underline" href="/privacy">
                Privacy
              </a>
              <a className="underline" href="/guidelines">
                Guidelines
              </a>
              <a className="underline" href="/settings">
                Session
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
