import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/40 p-8 sm:p-14 text-center backdrop-blur-xs shadow-xs"
      role="status"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-inner">
        <BrandMark size="lg" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        This Sanctuary is Silent &amp; Empty
      </h1>

      <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
        The page you seek could not be found, has moved, or the confession has been secluded by
        moderation.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Link href="/feed">
          <Button className="rounded-full gap-2 font-medium px-6">
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Main Feed</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
