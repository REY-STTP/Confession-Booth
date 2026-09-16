import Link from 'next/link';
import { ShieldCheck, Info } from 'lucide-react';
import { ComposerForm } from '@/app/components/composer';

export default function ComposePage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <ComposerForm />

      {/* Reassurance & Guidelines footer */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground flex items-start gap-3 backdrop-blur-xs">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="leading-relaxed">
            By pressing <strong>Confess</strong>, you understand that confessions are publicly
            visible within the sanctuary, moderation may hide violating content, and on-chain
            records are historical without personal identities.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link href="/guidelines" className="text-primary hover:underline font-medium">
              Community Guidelines →
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy &amp; Cryptography Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
