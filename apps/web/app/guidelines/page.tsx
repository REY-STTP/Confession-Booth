import Link from 'next/link';
import { BookOpen, ShieldAlert, CheckCircle2, ArrowRight, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const FORBIDDEN_ITEMS = [
  {
    title: 'Credible Threats',
    desc: 'Threats of violence or physical harm against individuals or groups.',
  },
  {
    title: 'Targeted Harassment',
    desc: 'Repeated bullying, intimidation, or targeted harassment.',
  },
  {
    title: 'Doxxing & Private Data',
    desc: 'Disclosing full names, phone numbers, home addresses, or confidential personal data.',
  },
  {
    title: 'Credentials & Keys',
    desc: 'Sharing passwords, private keys, authentication tokens, or unauthorized access credentials.',
  },
  {
    title: 'Child Exploitation',
    desc: 'Any form of material involving harm or exploitation of minors (Zero tolerance).',
  },
  {
    title: 'Instructions for Crime',
    desc: 'Guides or instructions facilitating criminal acts and violence.',
  },
  {
    title: 'Malware & Phishing',
    desc: 'Malicious links, scam domains, or social engineering manipulation.',
  },
  {
    title: 'Spam & Malicious Automation',
    desc: 'Flooding repetitive messages, commercial promotions, or manipulative bots.',
  },
];

export default function GuidelinesPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-border/40 pb-5 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Community Guidelines
          </h1>
          <Badge variant="outline" className="font-mono text-xs">
            v1.0
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Community standards designed to preserve the peace, sanctity, and emotional safety of
          every soul sharing in this confession sanctuary.
        </p>
      </div>

      {/* Philosophy */}
      <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          1. Sanctuary Philosophy
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          True anonymity exists so people can be honest with themselves without fear of social ruin
          or public judgment. However,{' '}
          <strong>anonymity is not the absence of accountability</strong>. Your freedom of
          expression ends when words are weaponized to inflict real-world harm on others.
        </p>
      </section>

      {/* Content Limits */}
      <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          2. Technical Constraints
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-1">
            <span className="font-semibold text-foreground block">Primary Confession</span>
            <p className="text-muted-foreground">
              Maximum 500 characters, plaintext only, single primary emotion tag.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-1">
            <span className="font-semibold text-foreground block">Thread Whisper</span>
            <p className="text-muted-foreground">
              Maximum 300 characters, plaintext only, replies to a confession or another whisper.
            </p>
          </div>
        </div>
      </section>

      {/* Prohibited Content */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            3. Strictly Prohibited Content
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FORBIDDEN_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-1 hover:border-destructive/40 transition-colors"
            >
              <span className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{item.title}</span>
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Moderation Workflow */}
      <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-4 shadow-sm">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          4. Transparent Moderation Workflow
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-center flex-1">
            <span className="font-semibold text-foreground block">1. Community Reports</span>
            <span>Flagged via the Report button</span>
          </div>
          <ArrowRight className="h-4 w-4 mx-auto hidden sm:block opacity-40" />
          <div className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-center flex-1">
            <span className="font-semibold text-foreground block">2. Triage &amp; Quarantine</span>
            <span>Priority triage &amp; immediate hide</span>
          </div>
          <ArrowRight className="h-4 w-4 mx-auto hidden sm:block opacity-40" />
          <div className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-center flex-1">
            <span className="font-semibold text-foreground block">3. Open Audit Log</span>
            <span>Actions recorded without doxxing</span>
          </div>
        </div>
      </section>

      <div className="pt-2 flex items-center justify-between">
        <Link href="/feed">
          <Button variant="outline" size="sm" className="rounded-full">
            ← Back to Feed
          </Button>
        </Link>
        <Link href="/privacy">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Privacy &amp; Cryptography Policy →
          </Button>
        </Link>
      </div>
    </div>
  );
}
