'use client';

import * as React from 'react';
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Hash,
  Database,
  Layers,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/booth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ProofData {
  publicId: string;
  contentHash: string;
  txHash: string | null;
  blockNumber: number | null;
  status: string;
  contractAddress: string | null;
  chainId: string;
}

interface ProofInspectorProps {
  publicId: string;
  proofType?: string;
  className?: string;
}

export function ProofInspector({ publicId, proofType, className }: ProofInspectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [proof, setProof] = React.useState<ProofData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || proof) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_URL}/api/confessions/${encodeURIComponent(publicId)}/proof`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data: ProofData) => {
        if (!cancelled) setProof(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            'On-chain cryptographic proof data is not yet available or is queued in indexing.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, publicId, proof]);

  async function copyValue(key: string, val: string, label: string) {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error(`Failed to copy ${label}`);
    }
  }

  const isZk = proofType === 'ZK';

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200',
        isOpen ? 'border-primary/40 shadow-card' : 'hover:border-border',
        className,
      )}
    >
      {/* Header / Toggle Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg border text-xs',
              isZk
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-primary/30 bg-primary/10 text-primary',
            )}
            aria-hidden="true"
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground">
                Cryptographic Proof Inspector
              </span>
              <Badge
                variant={isZk ? 'zk' : 'secondary'}
                className="text-[10px] py-0 px-2 h-5 font-mono"
              >
                {isZk ? 'ZK Stealth Proof' : 'EIP-712 Session'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Verify cryptographic authenticity and blockchain publication records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden xs:inline-block font-mono text-[11px]">
            {isOpen ? 'Hide' : 'Inspect Proof'}
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 transition-transform" />
          ) : (
            <ChevronDown className="h-4 w-4 transition-transform" />
          )}
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen ? (
        <div className="border-t border-border/50 bg-background/50 p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="space-y-3 py-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 text-xs text-muted-foreground">
              <p>{error}</p>
              <p className="mt-1 text-[11px] opacity-70">
                Confession remains safe and stored in the decentralized sanctuary.
              </p>
            </div>
          ) : proof ? (
            <div className="grid gap-3 text-xs">
              {/* Publication Status & Network */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground">Status On-Chain:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono text-[10px] py-0 h-5',
                      proof.status === 'CONFIRMED'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                    )}
                  >
                    {proof.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <Layers className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                  <span>Sepolia Testnet (Chain #{proof.chainId})</span>
                </div>
              </div>

              {/* Content Hash (SHA-256) */}
              <div className="space-y-1 rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-primary" />
                    Content Digest (Canonical SHA-256)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyValue('contentHash', proof.contentHash, 'Content Digest')}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedKey === 'contentHash' ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedKey === 'contentHash' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-foreground/90 break-all select-all bg-background/60 p-2 rounded border border-border/40">
                  {proof.contentHash}
                </div>
              </div>

              {/* Transaction Hash */}
              <div className="space-y-1 rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Cpu className="h-3 w-3 text-primary" />
                    Transaction Hash (On-Chain Anchor)
                  </span>
                  {proof.txHash ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyValue('txHash', proof.txHash!, 'Transaction Hash')}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedKey === 'txHash' ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedKey === 'txHash' ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${proof.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <span>Etherscan</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="font-mono text-[11px] text-foreground/90 break-all select-all bg-background/60 p-2 rounded border border-border/40">
                  {proof.txHash ?? 'Awaiting on-chain batch anchor (mempool queue)...'}
                </div>
              </div>

              {/* Contract & Block Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 rounded-lg border border-border/60 bg-card/60 p-3">
                  <span className="text-muted-foreground font-medium block">Block Height</span>
                  <p className="font-mono text-xs text-foreground">
                    {proof.blockNumber ? `#${proof.blockNumber.toLocaleString()}` : 'Pending'}
                  </p>
                </div>

                {(() => {
                  const contractAddr =
                    proof.contractAddress && !proof.contractAddress.startsWith('0x0000')
                      ? proof.contractAddress
                      : '0x22bEfE0BF04Ee694bdAe5CA20A06bE9F93c6dFd0';
                  return (
                    <div className="space-y-1 rounded-lg border border-border/60 bg-card/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium block">
                          Contract Address
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => copyValue('contract', contractAddr, 'Contract Address')}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedKey === 'contract' ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedKey === 'contract' ? 'Copied' : 'Copy'}</span>
                          </button>
                          <a
                            href={`https://sepolia.etherscan.io/address/${contractAddr}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            <span>Etherscan</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      <p className="font-mono text-[11px] text-foreground break-all select-all">
                        {contractAddr}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
