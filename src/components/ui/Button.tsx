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
    'bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-semibold shadow-sm border border-amber-300/40',
  secondary:
    'bg-[#1B2233] hover:bg-[#232C42] text-stone-100 font-semibold border border-white/15',
  ghost:
    'bg-transparent hover:bg-white/8 text-stone-200 font-medium border border-transparent',
  danger:
    'bg-rose-950/70 hover:bg-rose-900/80 text-rose-100 font-semibold border border-rose-500/40',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3.5 py-1.5 text-xs rounded-lg',
  md: 'min-h-[44px] px-5 py-2.5 text-sm rounded-lg',
  lg: 'min-h-[48px] px-6 py-3 text-sm sm:text-base rounded-xl',
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
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-45 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
