import * as React from 'react';
import {
  Flame,
  Heart,
  CloudRain,
  Zap,
  Smile,
  HeartHandshake,
  Moon,
  GitMerge,
  ShieldCheck,
  Award,
  GraduationCap,
  Briefcase,
  Mail,
  Compass,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
  size?: number;
}

/** Reaction icon components replacing OS emojis */
export function ReactionIcon({ type, className }: { type: string; className?: string }) {
  const normalized = type.toLowerCase();
  switch (normalized) {
    case 'understand':
      return <Flame className={cn('h-3.5 w-3.5 text-amber-400', className)} aria-hidden="true" />;
    case 'love':
      return <Heart className={cn('h-3.5 w-3.5 text-rose-400', className)} aria-hidden="true" />;
    case 'sad':
      return <CloudRain className={cn('h-3.5 w-3.5 text-sky-400', className)} aria-hidden="true" />;
    case 'wild':
      return <Zap className={cn('h-3.5 w-3.5 text-violet-400', className)} aria-hidden="true" />;
    case 'funny':
      return <Smile className={cn('h-3.5 w-3.5 text-emerald-400', className)} aria-hidden="true" />;
    default:
      return (
        <Sparkles
          className={cn('h-3.5 w-3.5 text-muted-foreground', className)}
          aria-hidden="true"
        />
      );
  }
}

/** Soulbound badge icon components replacing OS emojis */
export function BadgeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'EMPATHETIC_LISTENER':
      return (
        <HeartHandshake
          className={cn('h-3.5 w-3.5 text-emerald-400', className)}
          aria-hidden="true"
        />
      );
    case 'MIDNIGHT_SOUL':
      return <Moon className={cn('h-3.5 w-3.5 text-indigo-400', className)} aria-hidden="true" />;
    case 'CHAIN_WEAVER':
      return (
        <GitMerge className={cn('h-3.5 w-3.5 text-amber-400', className)} aria-hidden="true" />
      );
    case 'STEALTH_CONFESSOR':
      return (
        <ShieldCheck className={cn('h-3.5 w-3.5 text-cyan-400', className)} aria-hidden="true" />
      );
    default:
      return <Award className={cn('h-3.5 w-3.5 text-primary', className)} aria-hidden="true" />;
  }
}

/** Room theme icon components replacing OS emojis */
export function RoomIcon({ slug, className }: { slug: string; className?: string }) {
  switch (slug) {
    case 'campus-life':
      return <GraduationCap className={cn('h-6 w-6 text-primary', className)} aria-hidden="true" />;
    case 'workplace-burnout':
      return <Briefcase className={cn('h-6 w-6 text-amber-400', className)} aria-hidden="true" />;
    case 'unsent-letters':
      return <Mail className={cn('h-6 w-6 text-rose-400', className)} aria-hidden="true" />;
    case 'deep-existential':
      return <Compass className={cn('h-6 w-6 text-sky-400', className)} aria-hidden="true" />;
    case 'midnight-thoughts':
      return <Moon className={cn('h-6 w-6 text-indigo-400', className)} aria-hidden="true" />;
    default:
      return <MessageSquare className={cn('h-6 w-6 text-primary', className)} aria-hidden="true" />;
  }
}
