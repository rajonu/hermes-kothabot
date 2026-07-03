'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  description?: string;
  dotColor?: string;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  description,
  dotColor = 'bg-emerald-400',
  badge,
  badgeColor = 'bg-emerald-600',
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="mb-4 scroll-mt-20 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
          <span className="text-sm font-semibold text-white truncate">{title}</span>
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor} text-white shrink-0`}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {description && <p className="text-xs text-gray-500 mb-4">{description}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
