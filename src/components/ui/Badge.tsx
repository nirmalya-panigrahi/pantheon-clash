import type { ReactNode } from 'react';

export type BadgeTone =
  | 'gold'
  | 'sky'
  | 'nether'
  | 'sea'
  | 'war'
  | 'emerald'
  | 'crimson'
  | 'neutral';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  gold: 'bg-amber-400/20 text-amber-100 border-amber-300/40',
  sky: 'bg-sky-400/20 text-sky-100 border-sky-300/40',
  nether: 'bg-violet-400/20 text-violet-100 border-violet-300/40',
  sea: 'bg-cyan-400/20 text-cyan-100 border-cyan-300/40',
  war: 'bg-rose-400/20 text-rose-100 border-rose-300/40',
  emerald: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40',
  crimson: 'bg-rose-400/20 text-rose-100 border-rose-300/40',
  neutral: 'bg-white/10 text-white border-white/20',
};

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border backdrop-blur-md text-[11px] font-semibold tracking-wide whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
