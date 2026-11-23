import type { ReactNode } from 'react';

export type BadgeTone =
  | 'gold'
  | 'sky'
  | 'underworld'
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
  gold: 'bg-amber-500/15 text-amber-200 border-amber-400/35',
  sky: 'bg-amber-500/15 text-amber-900 border-amber-600/35',
  underworld: 'bg-violet-500/15 text-violet-900 border-violet-600/35',
  sea: 'bg-sky-500/15 text-sky-900 border-sky-600/35',
  war: 'bg-rose-500/15 text-rose-900 border-rose-600/35',
  emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35',
  crimson: 'bg-rose-500/15 text-rose-200 border-rose-400/35',
  neutral: 'bg-slate-800/80 text-stone-200 border-white/15',
};

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-wide whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
