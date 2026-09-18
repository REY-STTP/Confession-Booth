import Link from 'next/link';
import { ShieldCheck, Lock, AlertTriangle, EyeOff, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-border/40 pb-5 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Privacy Notice
          </h1>
          <Badge variant="outline" className="font-mono text-xs">
            v1.0
          </Badge>
        </div>
        <p className="text-base sm:text-lg font-medium text-foreground">
          &ldquo;Your confession is public. Your profile doesn&rsquo;t have to be.&rdquo;
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid gap-4">
        {/* Principle 1 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              1. No Public Profiles or Third-Party Tracking
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Confession Booth is fundamentally engineered so anyone can express themselves without
            exposing a public identity. Our feed does not disclose wallet addresses, centralized
            user IDs, user IP addresses, or covert telemetry logs.
          </p>
        </section>

        {/* Principle 2 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              2. Zero-Knowledge Cryptography (ZK Stealth)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            In ZK Stealth mode, membership proofs are generated locally within your browser using
            cryptographic Merkle Proof and Epoch Nullifier algorithms. The submission payload is
            transmitted to the backend server{' '}
            <strong>without authentication headers or session tokens</strong>, making it
            mathematically impossible for the server to correlate the confession with the
            author&rsquo;s wallet address.
          </p>
        </section>

        {/* Principle 3 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              3. Honest Privacy Boundaries
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            We <strong>never promise absolute or magical anonymity</strong>. Blockchain transaction
            histories, RPC/network metadata, and behavioral patterns can still create correlation
            risks.
          </p>
          {/* P2 #20: batas unlinkability yang jujur dan eksplisit. */}
          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong>Whispers &amp; reactions are pseudonymous, not zero-knowledge:</strong> they
              are sent under your session and stay linkable on the server, even though the public
              sees only anonymous names.
            </li>
            <li>
              <strong>OP badges shrink the anonymity set:</strong> replies marked as the original
              poster reveal authorship correlation to observers.
            </li>
            <li>
              <strong>Content hashes are deterministic:</strong> very short confessions could be
              brute-forced by anyone comparing hashes.
            </li>
          </ul>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <strong>Important Warning:</strong> Never write names, locations, phone numbers, or
            unique details that could easily identify you or someone else.
          </div>
        </section>

        {/* Principle 4 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              4. Immutable Blockchain Records
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Every confession is permanently anchored via canonical cryptographic digest (SHA-256) on
            the Ethereum Sepolia network. While the moderation team can quarantine violations from
            the public app feed, published blockchain transaction hashes are permanent and cannot be
            retroactively erased.
          </p>
        </section>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <Link href="/feed">
          <Button variant="outline" size="sm" className="rounded-full">
            ← Back to Feed
          </Button>
        </Link>
        <Link href="/guidelines">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Community Guidelines →
          </Button>
        </Link>
      </div>
    </div>
  );
}
