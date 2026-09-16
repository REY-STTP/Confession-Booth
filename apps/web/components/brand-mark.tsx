import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BrandMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-12',
  xl: 'size-16',
};

export function BrandMark({ size = 'md', className, ...props }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Confession Booth Mark"
      className={cn('shrink-0', sizeMap[size], className)}
      {...props}
    >
      <defs>
        <radialGradient id="bm-bgGlow" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#2a1a45" />
          <stop offset="45%" stopColor="#160f22" />
          <stop offset="100%" stopColor="#0a0810" />
        </radialGradient>

        <linearGradient id="bm-flameFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f2ecff" />
          <stop offset="28%" stopColor="#c9a9fa" />
          <stop offset="62%" stopColor="#9b6ff0" />
          <stop offset="100%" stopColor="#5b2fae" />
        </linearGradient>

        <radialGradient id="bm-flameHalo" cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#c9a9fa" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#7c4fe0" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7c4fe0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background circle */}
      <rect width="512" height="512" rx="128" fill="url(#bm-bgGlow)" />

      {/* Ambient halo */}
      <circle cx="256" cy="252" r="190" fill="url(#bm-flameHalo)" />

      {/* Confession flame with keyhole silhouette */}
      <path
        fillRule="evenodd"
        fill="url(#bm-flameFill)"
        d="
          M 256 120
          C 300 176 332 214 332 268
          C 332 324 298 366 256 366
          C 214 366 180 324 180 268
          C 180 214 212 176 256 120
          Z
          M 256 230
          a 34 34 0 1 0 0.1 0
          Z
          M 240 288 L 272 288 L 283 340 Q 256 354 229 340 Z
        "
      />

      {/* Rim light */}
      <path
        d="
          M 256 120
          C 300 176 332 214 332 268
          C 332 324 298 366 256 366
        "
        fill="none"
        stroke="#f2ecff"
        strokeOpacity="0.35"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
