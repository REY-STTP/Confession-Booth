import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { SessionProvider } from '@/lib/session';
import { HeaderNav } from '@/app/components/header-nav';
import { Toaster } from '@/components/ui/sonner';
import { BrandMark } from '@/components/brand-mark';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090d',
};

export const metadata: Metadata = {
  title: {
    template: '%s | Confession Booth',
    default: 'Confession Booth (UNSAID) — Say what you can’t say',
  },
  description:
    'Anonymous decentralized confession sanctuary. Your confession is public. Your profile doesn’t have to be.',
  openGraph: {
    title: 'Confession Booth — Say what you can’t say',
    description:
      'Anonymous decentralized confession sanctuary. Express your deepest truths without social identity or algorithmic tracking.',
    type: 'website',
    locale: 'id_ID',
    siteName: 'Confession Booth',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Confession Booth — Say what you can’t say',
    description:
      'Anonymous decentralized confession sanctuary. Express your deepest truths without social identity or algorithmic tracking.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col justify-between selection:bg-primary/30 selection:text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:font-medium focus:shadow-lg"
        >
          Lewati ke konten utama
        </a>

        <SessionProvider>
          <div className="flex-1 flex flex-col">
            <HeaderNav />
            <main id="main" className="mx-auto w-full max-w-4xl px-4 sm:px-6 pb-24 pt-8 flex-1">
              {children}
            </main>
          </div>
        </SessionProvider>

        <footer className="border-t border-border/70 bg-card/40 backdrop-blur-sm mt-auto">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-3 text-left">
              <BrandMark size="sm" className="size-6 opacity-80" />
              <div>
                <p className="font-medium text-foreground">
                  Confession Booth{' '}
                  <span className="font-mono text-[10px] text-muted-foreground">v1.0</span>
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Your confession is public. Your profile doesn&rsquo;t have to be.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs flex-wrap justify-center">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <span className="text-border">•</span>
              <Link href="/guidelines" className="hover:text-foreground transition-colors">
                Guidelines
              </Link>
              <span className="text-border">•</span>
              <Link href="/settings" className="hover:text-foreground transition-colors">
                Session & Badges
              </Link>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Sepolia
              </span>
            </div>
          </div>
        </footer>

        <Toaster />
      </body>
    </html>
  );
}
