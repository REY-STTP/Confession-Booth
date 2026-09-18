'use client';

import * as React from 'react';
import { ShieldCheck, Check, Loader2, Cpu, Lock, Network, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ZkStepperProps {
  open: boolean;
  currentStatus: string;
  onCancel?: () => void;
}

interface StepItem {
  id: number;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepItem[] = [
  {
    id: 1,
    label: 'Cryptographic Key',
    description: 'Derive deterministic anonymous identity via signature',
    icon: Lock,
  },
  {
    id: 2,
    label: 'Anonymous Merkle Tree',
    description: 'Synchronize root commitment & verify group membership',
    icon: Network,
  },
  {
    id: 3,
    label: 'ZK Proof Computation',
    description: 'Generate signal proof & nullifier locally in browser',
    icon: Cpu,
  },
  {
    id: 4,
    label: 'Unlinkable Publication',
    description: 'Broadcast confession with zero session tokens or wallet traces',
    icon: Send,
  },
];

export function ZkStepper({ open, currentStatus, onCancel }: ZkStepperProps) {
  // Determine active step index (0-3) based on currentStatus text
  let activeIndex = 0;
  const statusLower = currentStatus.toLowerCase();
  if (
    statusLower.includes('merkle') ||
    statusLower.includes('mendaftarkan') ||
    statusLower.includes('pool') ||
    statusLower.includes('registering') ||
    statusLower.includes('membership')
  ) {
    activeIndex = 1;
  } else if (
    statusLower.includes('membangkitkan') ||
    statusLower.includes('zero-knowledge') ||
    statusLower.includes('proof') ||
    statusLower.includes('generating') ||
    statusLower.includes('witness')
  ) {
    activeIndex = 2;
  } else if (
    statusLower.includes('menerbitkan') ||
    statusLower.includes('unlinkable') ||
    statusLower.includes('selesai') ||
    statusLower.includes('publishing') ||
    statusLower.includes('complete') ||
    statusLower.includes('broadcasting')
  ) {
    activeIndex = 3;
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md border-emerald-500/30 bg-card/95 backdrop-blur-md shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              ZK Stealth Computation
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Generating anonymous cryptographic proof in browser. Please wait and do not close this
            window.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Timeline */}
        <div className="space-y-3 py-3">
          {STEPS.map((step, idx) => {
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isPending = idx > activeIndex;
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition-all duration-200',
                  isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/10 shadow-xs'
                    : isDone
                      ? 'border-emerald-900/40 bg-emerald-950/20 opacity-80'
                      : 'border-border/40 bg-card/30 opacity-40',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs flex-shrink-0 transition-colors',
                    isDone
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : isCurrent
                        ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300 ring-2 ring-emerald-400/20'
                        : 'border-border text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <StepIcon className="h-3 w-3" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs font-semibold tracking-tight',
                        isCurrent
                          ? 'text-emerald-300'
                          : isDone
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </span>
                    {isCurrent ? (
                      <span className="font-mono text-[10px] text-emerald-400 animate-pulse">
                        Processing...
                      </span>
                    ) : isDone ? (
                      <span className="font-mono text-[10px] text-emerald-500">Complete</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live terminal message box */}
        <div className="rounded-lg border border-emerald-900/40 bg-black/60 p-2.5 font-mono text-[11px] text-emerald-400/90 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0 text-emerald-400" />
          <span className="truncate">{currentStatus || 'Preparing proof circuits...'}</span>
        </div>

        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>
            Signals are dispatched without wallet authorizations. Your identity never touches the
            server.
          </span>
        </p>

        {/* P1 #7: keluar darurat bila komputasi macet (PoW/ZK hang). */}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mx-auto flex items-center rounded-full border border-border/70 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
