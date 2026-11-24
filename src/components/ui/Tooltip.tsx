import { useId, useState, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        aria-describedby={open ? tooltipId : undefined}
        tabIndex={0}
        className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-amber-300 rounded"
      >
        {children}
      </span>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-xl glass-panel px-3 py-2 text-xs font-normal text-white shadow-2xl leading-relaxed text-left"
        >
          {content}
        </span>
      )}
    </span>
  );
}
