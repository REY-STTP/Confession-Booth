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
    label: 'Kunci Kriptografis',
    description: 'Menurunkan identitas anonim deterministik via signature',
    icon: Lock,
  },
  {
    id: 2,
    label: 'Pohon Merkle Anonim',
    description: 'Sinkronisasi akar komitmen & verifikasi keanggotaan pool',
    icon: Network,
  },
  {
    id: 3,
    label: 'Komputasi ZK Proof',
    description: 'Membangkitkan bukti sinyal & nullifier secara lokal di browser',
    icon: Cpu,
  },
  {
    id: 4,
    label: 'Publikasi Unlinkable',
    description: 'Menyiarkan confession tanpa token sesi maupun jejak wallet',
    icon: Send,
  },
];

export function ZkStepper({ open, currentStatus }: ZkStepperProps) {
  // Determine active step index (0-3) based on currentStatus text
  let activeIndex = 0;
  if (
    currentStatus.includes('Merkle') ||
    currentStatus.includes('Mendaftarkan') ||
    currentStatus.includes('pool')
  ) {
    activeIndex = 1;
  } else if (
    currentStatus.includes('Membangkitkan') ||
    currentStatus.includes('Zero-Knowledge') ||
    currentStatus.includes('Proof')
  ) {
    activeIndex = 2;
  } else if (
    currentStatus.includes('Menerbitkan') ||
    currentStatus.includes('unlinkable') ||
    currentStatus.includes('selesai')
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
              Komputasi ZK Stealth
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Membangkitkan bukti kriptografi anonim di browser. Harap tunggu dan jangan tutup halaman
            ini.
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
                        Memproses...
                      </span>
                    ) : isDone ? (
                      <span className="font-mono text-[10px] text-emerald-500">Selesai</span>
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
          <span className="truncate">{currentStatus || 'Menyiapkan sirkuit bukti...'}</span>
        </div>

        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>
            Sinyal dikirim tanpa otorisasi wallet. Identitas Anda tidak pernah bocor ke server.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
