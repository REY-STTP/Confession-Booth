'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  MessageSquare,
  Clock,
  Link2,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { timeAgo, type FeedItem, BADGE_META, safeDisplayName } from '@/lib/booth';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BrandMark } from '@/components/brand-mark';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReactionIcon, BadgeIcon } from '@/components/icon-helpers';

export function BoothCard({ item }: { item: FeedItem }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/confessions/${item.publicId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Confession link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }

  const badgeMeta = item.badgeType
    ? (BADGE_META[item.badgeType] ?? {
        label: item.badgeType.replace(/_/g, ' '),
        icon: 'shield-check',
        desc: 'Community badge',
        color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      })
    : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        className="group relative border-border/75 bg-card/80 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-card-hover"
        role="article"
        aria-label={`Confession by ${safeDisplayName(item.author.displayName)}`}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2 sm:p-5 sm:pb-3">
          {/* Author & Proof info */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-muted/40 text-muted-foreground"
              aria-hidden="true"
            >
              <BrandMark size="sm" />
            </div>
            <span className="font-medium text-xs sm:text-sm text-foreground tracking-tight">
              {safeDisplayName(item.author.displayName)}
            </span>

            {item.proofType === 'ZK' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="zk" className="cursor-help gap-1 h-5 px-2 py-0 text-[10px]">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    <span>Anon</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-semibold text-emerald-400">Anonymous (Unverified)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Posted without session or wallet linkage. Full zero-knowledge verification is
                    not yet enforced.
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : null}

            {badgeMeta ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-help transition-opacity hover:opacity-90',
                      badgeMeta.color,
                    )}
                  >
                    <BadgeIcon type={item.badgeType ?? ''} className="h-3 w-3" />
                    <span>{badgeMeta.label}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-semibold">{badgeMeta.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{badgeMeta.desc}</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          {/* Metadata: Room, Category, Timestamp */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
            {item.roomSlug ? (
              <Link
                href={`/rooms/${item.roomSlug}`}
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/20 transition-colors"
                title={`Room #${item.roomSlug}`}
              >
                #{item.roomSlug}
              </Link>
            ) : null}

            <Link
              href={`/feed?category=${encodeURIComponent(item.category)}`}
              className="hidden xs:inline-flex items-center rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-border hover:text-foreground transition-colors capitalize"
            >
              {item.category}
            </Link>

            <time
              dateTime={item.createdAt}
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <Clock className="h-3 w-3 opacity-60" aria-hidden="true" />
              <span>{timeAgo(item.createdAt)}</span>
            </time>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4 pt-1 pb-3 sm:p-5 sm:pt-1 sm:pb-4">
          <Link
            href={`/confessions/${item.publicId}`}
            className="group/link block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
          >
            <p className="whitespace-pre-wrap font-sans text-sm sm:text-[15px] leading-relaxed text-foreground/90 selection:bg-primary/30 break-words group-hover/link:text-foreground transition-colors">
              {item.content}
            </p>
          </Link>
        </CardContent>

        {/* Actions & Reactions Footer */}
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 p-4 pt-3 sm:p-5 sm:pt-3">
          {/* Reactions */}
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Reactions">
            {Object.entries(item.reactions).map(([k, v]) => (
              <Link
                key={k}
                href={`/confessions/${item.publicId}`}
                aria-label={`${v} reactions ${k}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border transition-all duration-150"
              >
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:scale-110 flex items-center"
                >
                  <ReactionIcon type={k} />
                </span>
                <span className="font-mono text-[11px] font-medium">{v}</span>
              </Link>
            ))}
          </div>

          {/* Whispers & Share */}
          <div className="flex items-center gap-2">
            <Link
              href={`/confessions/${item.publicId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all duration-150"
              aria-label={`${item.whisperCount} whispers, open detail`}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono text-[11px] font-medium">{item.whisperCount}</span>
              <span className="hidden sm:inline text-[11px]">whispers</span>
              <ArrowRight className="h-3 w-3 opacity-60 ml-0.5" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={handleCopyLink}
              aria-label="Copy confession link"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground transition-all duration-150"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3 opacity-70" aria-hidden="true" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

export function Empty({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-10 sm:p-14 text-center backdrop-blur-xs shadow-xs"
      role="status"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-inner">
        <BrandMark size="md" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {sub ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{sub}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4" aria-hidden="true" aria-label="Loading confessions">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm"
        >
          {/* Header skeleton */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-3 w-12 rounded-md" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-2 py-1">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-11/12 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>

          {/* Footer skeleton */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-12 rounded-full" />
              <Skeleton className="h-7 w-12 rounded-full" />
              <Skeleton className="h-7 w-12 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-14 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
