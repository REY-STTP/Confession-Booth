'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  Landmark,
  TrendingUp,
  Moon,
  Plus,
  Menu,
  Shield,
  ShieldCheck,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSession } from '@/lib/session';

interface NavItem {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'Feed', icon: MessageSquare },
  { href: '/rooms', label: 'Rooms', icon: Landmark, badge: 'New' },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/midnight', label: 'Midnight', icon: Moon },
];

export function HeaderNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const { state } = useSession();

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md transition-all">
      <nav
        className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6"
        aria-label="Navigasi Utama"
      >
        {/* Brand Mark & Title */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-transform active:scale-[0.98]"
        >
          <BrandMark
            size="sm"
            className="size-8 shrink-0 transition-transform group-hover:scale-105"
          />
          <span className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors leading-none">
            Confession Booth
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ${
                  active
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {item.badge ? (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Desktop Right Actions: Session Status + Confess Button */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            {state === 'booth' ? (
              <>
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span className="font-medium text-emerald-400">In Booth</span>
              </>
            ) : (
              <>
                <Shield className="size-3.5" />
                <span>Session</span>
              </>
            )}
          </Link>

          <Button asChild size="sm" className="rounded-full shadow-sm">
            <Link href="/compose">
              <Plus className="size-4" />
              <span>Confess</span>
            </Link>
          </Button>
        </div>

        {/* Mobile Actions: Confess Pill + Sheet Trigger */}
        <div className="flex md:hidden items-center gap-2">
          <Button asChild size="sm" className="rounded-full h-8 px-3 text-xs">
            <Link href="/compose">
              <Plus className="size-3.5" />
              <span>Confess</span>
            </Link>
          </Button>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-lg"
                aria-label="Buka menu navigasi"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[85vw] max-w-sm p-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <SheetHeader className="text-left space-y-1">
                  <div className="flex items-center gap-2.5">
                    <BrandMark size="sm" className="size-8" />
                    <SheetTitle className="text-base font-semibold">Confession Booth</SheetTitle>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Say what you can&rsquo;t say. Nobody needs to know who you are.
                  </p>
                </SheetHeader>

                {/* Session Status Banner */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {state === 'booth' ? (
                      <>
                        <ShieldCheck className="size-4 text-emerald-400" />
                        <div>
                          <p className="font-medium text-foreground">Sesi Terverifikasi</p>
                          <p className="text-[11px] text-muted-foreground">
                            Siap menulis & bereaksi
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Shield className="size-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Mode Pengunjung</p>
                          <p className="text-[11px] text-muted-foreground">
                            Identitas anonim lokal
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <Link
                    href="/settings"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Atur
                  </Link>
                </div>

                <Separator />

                {/* Navigation Links */}
                <div className="flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          active
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Drawer Footer */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <Link
                    href="/guidelines"
                    className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >
                    <BookOpen className="size-3.5" />
                    <span>Guidelines</span>
                  </Link>
                  <Link
                    href="/privacy"
                    className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >
                    <Shield className="size-3.5" />
                    <span>Privacy</span>
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>Settings</span>
                  </Link>
                  <a
                    href="https://sepolia.etherscan.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span>Sepolia</span>
                  </a>
                </div>

                <Button asChild className="w-full rounded-xl">
                  <Link href="/compose">
                    <Plus className="size-4 mr-1.5" />
                    <span>Tulis Pengakuan</span>
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
