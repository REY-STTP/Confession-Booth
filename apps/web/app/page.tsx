import Link from 'next/link';
import { ArrowRight, ShieldCheck, Lock, EyeOff, PenLine, Moon, Sparkles } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { ReactionIcon } from '@/components/icon-helpers';

export default function Landing() {
  return (
    <div className="space-y-12 sm:space-y-16 py-4">
      {/* Hero Section */}
      <section
        className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/90 to-background/60 p-8 sm:p-14 text-center shadow-lg backdrop-blur-md"
        aria-label="Confession Sanctuary Hero"
      >
        {/* Breathing Ambient Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-primary/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo Brand Mark */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-primary shadow-inner">
            <BrandMark size="lg" />
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-2xl leading-tight sm:leading-none">
            Say what you can&rsquo;t say.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            An encrypted digital sanctuary for secrets, regrets, and unspoken truths. No names. No
            profiles. No judgment.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm">
            <Link href="/feed" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full px-8 py-6 text-sm sm:text-base font-semibold shadow-md gap-2"
              >
                <span>Enter the Booth</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/compose" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full px-7 py-6 text-sm sm:text-base font-medium border-border/80 bg-card/60 hover:bg-muted/50 gap-2"
              >
                <PenLine className="h-4 w-4 text-primary" />
                <span>Write Confession</span>
              </Button>
            </Link>
          </div>

          <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-muted-foreground">
            Your confession is public. Your profile doesn&rsquo;t have to be. Blockchain and network
            metadata can still create privacy risks — don&rsquo;t include information that could
            identify you.{' '}
            <Link href="/privacy" className="text-primary hover:underline font-medium">
              Learn about privacy boundaries →
            </Link>
          </p>
        </div>
      </section>

      {/* How It Works Bento Grid */}
      <section className="space-y-4" aria-label="How It Works">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Three Pillars of the Sanctuary
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Built upon a philosophy of radical privacy and pure empathy.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card 1 */}
          <div className="group rounded-2xl border border-border/70 bg-card/60 p-6 transition-all duration-200 hover:border-primary/40 hover:bg-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <EyeOff className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground tracking-tight">
                1. Anonymous Presence
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Freely explore all public confessions without connecting a wallet. No handles, no
                public profiles, and no follower graphs.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group rounded-2xl border border-border/70 bg-card/60 p-6 transition-all duration-200 hover:border-primary/40 hover:bg-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground tracking-tight">
                2. ZK Stealth &amp; Unlinkable
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Compose up to 500 characters with Zero-Knowledge cryptographic proofs. Submissions
                are dispatched without session tokens — your wallet address is never recorded in the
                database.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group rounded-2xl border border-border/70 bg-card/60 p-6 transition-all duration-200 hover:border-primary/40 hover:bg-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground tracking-tight">
                3. On-Chain Verified
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Every confession is permanently anchored to the Sepolia blockchain via SHA-256
                digest, guaranteeing historical authenticity without disclosing author identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Atmospheric Sanctuary Reactions & Midnight Highlight */}
      <section
        className="rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-8 space-y-4 backdrop-blur-sm"
        aria-label="Reactions and Midnight Archive"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>The Language of Empathy</span>
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Not judgmental like counters, but quiet signals that you are heard and understood:
            </p>
          </div>

          <Link href="/midnight">
            <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Midnight Archive →</span>
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {[
            ['understand', 'I understand', 'Pure understanding & resonance'],
            ['love', 'Sending love', 'Warm support'],
            ['sad', 'I feel this', 'Shared sorrow'],
            ['wild', 'That’s wild', 'Honest disbelief'],
            ['funny', 'I shouldn’t laugh', 'Dark humor relief'],
          ].map(([key, label, desc]) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/50 px-3.5 py-1.5 text-xs text-muted-foreground"
            >
              <ReactionIcon type={key} className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{label}</span>
              <span className="text-[10px] opacity-60 hidden md:inline">({desc})</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
