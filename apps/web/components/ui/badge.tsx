import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/20 text-primary hover:bg-primary/30 border-primary/30',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25',
        outline: 'border-border/80 text-muted-foreground bg-card/40',
        zk: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-[10px] tracking-wide',
        op: 'border-primary/40 bg-primary/15 text-primary font-semibold text-[10px]',
        category:
          'border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
