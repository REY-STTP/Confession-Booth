'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/booth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetType?: 'CONFESSION' | 'WHISPER';
}

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment / Bullying' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'doxxing', label: 'Personal Information Exposure (Doxxing)' },
  { value: 'spam', label: 'Spam / Unauthorized Advertising' },
  { value: 'other', label: 'Other Community Guidelines Violation' },
];

export function ReportDialog({
  open,
  onOpenChange,
  targetId,
  targetType = 'CONFESSION',
}: ReportDialogProps) {
  const [reason, setReason] = React.useState(REPORT_REASONS[0].value);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? data?.error?.code ?? 'Failed to submit report');
      }

      toast.success('Report submitted', {
        description: 'The moderation team will review this. Your privacy is fully preserved.',
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report.';
      setError(msg);
      toast.error('Failed to submit report', { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <DialogTitle className="text-lg font-bold">Report Confession</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Help preserve the sanctity of this confession booth by reporting content that violates
            community guidelines.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="report-reason" className="text-xs font-medium text-foreground">
              Choose Report Reason
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Sending...</span>
                </>
              ) : (
                <span>Submit Report</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
