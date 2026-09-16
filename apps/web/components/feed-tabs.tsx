'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, TrendingUp, Flame, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedTabsProps {
  className?: string;
}

const TABS = [
  {
    href: '/feed',
    label: 'Recent',
    sublabel: 'New',
    icon: Sparkles,
  },
  {
    href: '/trending',
    label: 'Trending',
    sublabel: '24h',
    icon: TrendingUp,
  },
  {
    href: '/relatable',
    label: 'Relatable',
    sublabel: 'Understood',
    icon: Flame,
  },
  {
    href: '/midnight',
    label: 'Midnight',
    sublabel: '00–04 WIB',
    icon: Moon,
  },
] as const;

export function FeedTabs({ className }: FeedTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Feed category navigation"
      className={cn(
        'flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-border/70 bg-card/60 p-1 backdrop-blur-sm shadow-sm',
        className,
      )}
    >
      {TABS.map((tab) => {
        const isActive =
          tab.href === '/feed'
            ? pathname === '/feed' || pathname === '/'
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
              isActive
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent',
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
              )}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
            <span
              className={cn(
                'hidden sm:inline font-mono text-[10px] opacity-70',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              ({tab.sublabel})
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
