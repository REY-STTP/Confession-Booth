'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Heart,
  HeartCrack,
  Lock,
  Sprout,
  GraduationCap,
  Briefcase,
  Home,
  Smile,
  CloudRain,
  Waves,
  Moon,
  Sparkles,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/booth';
import { cn } from '@/lib/utils';

interface CategoryPillsProps {
  activeCategory?: string;
  basePath?: string;
  searchQuery?: string;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  love: Heart,
  heartbreak: HeartCrack,
  secret: Lock,
  life: Sprout,
  school: GraduationCap,
  work: Briefcase,
  family: Home,
  funny: Smile,
  sad: CloudRain,
  deep: Waves,
  midnight: Moon,
};

export function CategoryPills({
  activeCategory = '',
  basePath = '/feed',
  searchQuery = '',
  className,
}: CategoryPillsProps) {
  function getHref(cat?: string) {
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (searchQuery) params.set('q', searchQuery);
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  return (
    <div
      aria-label="Confession category filters"
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs select-none',
        className,
      )}
    >
      {/* "All" pill */}
      <Link
        href={getHref()}
        aria-current={!activeCategory ? 'page' : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring border',
          !activeCategory
            ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
            : 'bg-card/50 text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground hover:border-border',
        )}
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        <span>All</span>
      </Link>

      {CATEGORIES.map((c) => {
        const isActive = activeCategory.toLowerCase() === c.toLowerCase();
        const Icon = CATEGORY_ICONS[c];

        return (
          <Link
            key={c}
            href={getHref(c)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring border capitalize',
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                : 'bg-card/50 text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground hover:border-border',
            )}
          >
            {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
            <span>{c}</span>
          </Link>
        );
      })}
    </div>
  );
}
