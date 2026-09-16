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
            Dengan menekan <strong>Confess</strong>, Anda memahami bahwa konten bersifat publik
            dalam suaka, moderasi dapat menyembunyikan konten yang melanggar, dan publikasi on-chain
            bersifat historis tanpa identitas pribadi.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link href="/guidelines" className="text-primary hover:underline font-medium">
              Panduan Komunitas (Guidelines) →
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Kebijakan Privasi & Kriptografi
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
