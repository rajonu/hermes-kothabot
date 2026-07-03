'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { CATEGORIES_CONFIG } from '@/lib/categories.config';

interface Props { enabledCategories: string[] }

export function CategoryToggleForm({ enabledCategories }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(enabledCategories));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const toggle = (value: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size === 1) return prev; // must keep at least one
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
    setSaved(false);
    setError('');
  };

  const handleSave = () => {
    setError('');
    start(async () => {
      const res = await fetch('/api/admin/set-enabled-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: Array.from(selected) }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to save');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CATEGORIES_CONFIG.map(cat => {
          const on = selected.has(cat.value);
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => toggle(cat.value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                on
                  ? 'border-emerald-500 bg-emerald-600/10 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
              }`}
            >
              <span>{cat.emoji}</span>
              <span className="truncate">{cat.label}</span>
              {on && <Check size={11} className="ml-auto shrink-0 text-emerald-400" />}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500">
        {selected.size} of {CATEGORIES_CONFIG.length} enabled · Toggled-off categories are hidden on the signup form. At least one must stay on.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={pending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
      >
        {pending ? <><Loader2 size={13} className="animate-spin" /> Saving…</> :
         saved   ? <><Check size={13} /> Saved!</> : 'Save Changes'}
      </button>
    </div>
  );
}
