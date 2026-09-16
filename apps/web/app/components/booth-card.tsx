'use client';

import { timeAgo, type FeedItem } from '@/lib/booth';

const EMOJI: Record<string, string> = {
  understand: '🕯️',
  love: '❤️',
  sad: '😭',
  wild: '💀',
  funny: '😂',
};

export function BoothCard({ item }: { item: FeedItem }) {
  return (
    <article className="booth-card p-5" aria-label={`Confession ${item.author.displayName}`}>
      <div className="flex items-center justify-between text-xs text-booth-dim">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-booth-ink">{item.author.displayName}</span>
          {item.proofType === 'ZK' ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-700/60 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] text-emerald-400"
              title="Zero-Knowledge Anonymous Proof (Unlinkable)"
            >
              🛡️ ZK
            </span>
          ) : null}
          {item.badgeType ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 font-medium"
              title={`Badge: ${item.badgeType}`}
            >
              🏅 {item.badgeType.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-booth-dim">
          {item.roomSlug ? (
            <a
              href={`/rooms/${item.roomSlug}`}
              className="rounded-full border border-booth-line/80 bg-booth-line/20 px-2 py-0.5 text-[11px] text-booth-accent hover:border-booth-accent transition-colors"
            >
              #{item.roomSlug}
            </a>
          ) : null}
          <span className="rounded-full border border-booth-line px-2 py-0.5">{item.category}</span>
          <span>{timeAgo(item.createdAt)}</span>
        </div>
      </div>
      {/* Render sebagai teks biasa — React escape otomatis (defense-in-depth, T1-004). */}
      <p className="mt-3 whitespace-pre-wrap leading-relaxed">{item.content}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Reaksi">
        {Object.entries(item.reactions).map(([k, v]) => (
          <span
            key={k}
            className="rounded-full border border-booth-line px-2.5 py-1 text-booth-dim"
          >
            {EMOJI[k] ?? '•'} {v}
          </span>
        ))}
        <a
          href={`/confessions/${item.publicId}`}
          className="rounded-full border border-booth-line px-2.5 py-1 text-booth-dim hover:text-booth-ink"
        >
          💬 {item.whisperCount} whispers →
        </a>
      </div>
    </article>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="booth-card p-10 text-center" role="status">
      <p className="text-lg font-semibold">{title}</p>
      {sub ? <p className="mt-2 text-sm text-booth-dim">{sub}</p> : null}
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="booth-card animate-pulse p-5">
          <div className="h-3 w-1/3 rounded bg-booth-line" />
          <div className="mt-3 h-3 w-full rounded bg-booth-line" />
          <div className="mt-2 h-3 w-2/3 rounded bg-booth-line" />
        </div>
      ))}
    </div>
  );
}
