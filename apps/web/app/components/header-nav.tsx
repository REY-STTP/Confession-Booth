'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/rooms', label: 'Rooms', badge: 'New' },
  { href: '/trending', label: 'Trending' },
  { href: '/midnight', label: 'Midnight' },
  { href: '/compose', label: 'Confess', highlight: true },
];

export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close menu when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close menu on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
  }, [open]);

  return (
    <header className="border-b border-booth-line sticky top-0 z-30 bg-booth-bg/95 backdrop-blur-sm">
      <nav
        className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5"
        aria-label="Utama"
      >
        <a
          href="/"
          className="text-lg font-semibold tracking-wide flex items-center gap-2 hover:text-booth-ink transition-colors"
        >
          <span aria-hidden="true">🕯️</span>
          <span>Confession Booth</span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex gap-4 text-sm text-booth-dim items-center">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`transition-colors flex items-center gap-1.5 ${
                  link.highlight
                    ? 'rounded-full border border-booth-accent/80 bg-booth-accent/15 px-3 py-1 font-medium text-booth-ink hover:bg-booth-accent/25'
                    : active
                      ? 'text-booth-ink font-medium'
                      : 'hover:text-booth-ink'
                }`}
              >
                {link.label}
                {link.badge ? (
                  <span className="rounded-full bg-booth-accent/30 px-1.5 py-0.2 text-[10px] text-booth-accent font-medium">
                    {link.badge}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>

        {/* Mobile Actions: Confess button + Hamburger Toggle */}
        <div className="flex sm:hidden items-center gap-2">
          <a
            href="/compose"
            className="rounded-full border border-booth-accent/80 bg-booth-accent/15 px-2.5 py-1 text-xs font-medium text-booth-ink"
            aria-label="Tulis confession baru"
          >
            + Confess
          </a>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="p-1.5 rounded-lg border border-booth-line text-booth-dim hover:text-booth-ink hover:border-booth-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-booth-accent"
          >
            <span className="sr-only">{open ? 'Tutup' : 'Menu'}</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {open ? (
        <div
          id="mobile-nav"
          className="sm:hidden border-t border-booth-line bg-booth-panel/95 backdrop-blur-md px-4 py-4 space-y-3"
          role="region"
          aria-label="Menu navigasi mobile"
        >
          <div className="grid gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-booth-line/30 text-booth-ink font-semibold'
                      : 'text-booth-dim hover:bg-booth-line/20 hover:text-booth-ink'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge ? (
                    <span className="rounded-full bg-booth-accent/30 px-2 py-0.5 text-[10px] text-booth-accent font-medium">
                      {link.badge}
                    </span>
                  ) : null}
                </a>
              );
            })}
          </div>
          <div className="border-t border-booth-line pt-3 flex flex-wrap gap-4 text-xs text-booth-dim px-3">
            <a href="/guidelines" className="hover:text-booth-ink">
              Guidelines
            </a>
            <a href="/privacy" className="hover:text-booth-ink">
              Privacy
            </a>
            <a href="/settings" className="hover:text-booth-ink">
              Session
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
