'use client';

import Link from 'next/link';
import { CATEGORIES } from '@/lib/booth';
import { cn } from '@/lib/utils';

interface CategoryPillsProps {
  activeCategory?: string;
  basePath?: string;
  searchQuery?: string;
  className?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  love: '💌',
  heartbreak: '💔',
  secret: '🤫',
  life: '🌱',
  school: '📚',
  work: '💼',
  family: '🏠',
  funny: '😂',
  sad: '🌧️',
  deep: '🌊',
  midnight: '🌒',
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
      aria-label="Filter kategori pengakuan"
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs select-none',
        className,
      )}
    >
      {/* "Semua" pill */}
      <Link
        href={getHref()}
        aria-current={!activeCategory ? 'true' : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring border',
          !activeCategory
            ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
            : 'bg-card/50 text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground hover:border-border',
        )}
      >
        <span>Semua</span>
      </Link>

      {CATEGORIES.map((c) => {
        const isActive = activeCategory.toLowerCase() === c.toLowerCase();
        const icon = CATEGORY_ICONS[c];

        return (
          <Link
            key={c}
            href={getHref(c)}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring border capitalize',
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                : 'bg-card/50 text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground hover:border-border',
            )}
          >
            {icon ? <span aria-hidden="true">{icon}</span> : null}
            <span>{c}</span>
          </Link>
        );
      })}
    </div>
  );
}
