'use client';

import { Reply, Clock, ShieldAlert, MessageSquare } from 'lucide-react';
import { timeAgo, type WhisperItem, BADGE_META } from '@/lib/booth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/brand-mark';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BadgeIcon } from '@/components/icon-helpers';

interface WhisperThreadProps {
  whispers: WhisperItem[];
  onReply: (replyTo: { id: string; author: string }) => void;
  replyTo: { id: string; author: string } | null;
  className?: string;
}

export function WhisperThread({ whispers, onReply, replyTo, className }: WhisperThreadProps) {
  const rootWhispers = whispers.filter((w) => !w.parentWhisperId);
  const getReplies = (parentId: string) => whispers.filter((w) => w.parentWhisperId === parentId);

  function renderNode(w: WhisperItem, isChild = false) {
    const replies = getReplies(w.id);
    const badgeMeta = w.badgeType ? BADGE_META[w.badgeType] : null;
    const isTargeted = replyTo?.id === w.id;

    return (
      <div
        key={w.id}
        className={cn(
          isChild ? 'mt-2.5 ml-2.5 sm:ml-5 pl-3 sm:pl-4 border-l-2 border-border/80' : '',
        )}
      >
        <div
          className={cn(
            'group relative rounded-xl border p-4 transition-all duration-200 bg-card/70 backdrop-blur-xs',
            isTargeted
              ? 'border-primary/60 bg-primary/5 shadow-xs'
              : 'border-border/70 hover:border-border hover:bg-card',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground tracking-tight">
                {w.author.displayName}
              </span>

              {/* OP Badge */}
              {w.isOp ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="op" className="cursor-help h-4 px-1.5 py-0 text-[10px]">
                      OP
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-semibold text-primary">Original Poster</p>
                    <p className="text-[11px] text-muted-foreground">
                      The original author of this confession.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}

              {/* Community Badge */}
              {badgeMeta ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] cursor-help',
                        badgeMeta.color,
                      )}
                    >
                      <BadgeIcon type={w.badgeType ?? ''} className="h-3 w-3" />
                      <span>{badgeMeta.label}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-semibold">{badgeMeta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{badgeMeta.desc}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            <time
              dateTime={w.createdAt}
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <Clock className="h-3 w-3 opacity-60" aria-hidden="true" />
              <span>{timeAgo(w.createdAt)}</span>
            </time>
          </div>

          {/* Content */}
          <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-sans break-words selection:bg-primary/30">
            {w.content}
          </p>

          {/* Action Row */}
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40 text-xs">
            <button
              type="button"
              onClick={() => onReply({ id: w.id, author: w.author.displayName })}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-xs font-medium"
            >
              <Reply className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reply to this thread</span>
            </button>

            {replies.length > 0 ? (
              <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3 opacity-60" aria-hidden="true" />
                <span>{replies.length} replies</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Recursive Children */}
        {replies.length > 0 ? (
          <div className="space-y-2.5 mt-2">{replies.map((reply) => renderNode(reply, true))}</div>
        ) : null}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-3', className)}>
        {whispers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-8 text-center text-xs sm:text-sm text-muted-foreground">
            <p>No whispers yet. Be the first to start this anonymous discussion.</p>
          </div>
        ) : (
          rootWhispers.map((w) => renderNode(w))
        )}
      </div>
    </TooltipProvider>
  );
}
