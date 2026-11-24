import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-slate-950 font-semibold shadow-[0_6px_20px_rgba(245,158,11,0.28)] border border-amber-200/70',
  secondary:
    'glass-panel-md hover:bg-white/20 text-white font-semibold',
  ghost:
    'bg-white/5 hover:bg-white/15 text-white font-medium border border-white/15 backdrop-blur-md',
  danger:
    'bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 font-semibold border border-rose-400/35 backdrop-blur-md',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3.5 py-1.5 text-xs rounded-xl',
  md: 'min-h-[44px] px-5 py-2.5 text-sm rounded-xl',
  lg: 'min-h-[48px] px-6 py-3 text-sm sm:text-base rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-45 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
