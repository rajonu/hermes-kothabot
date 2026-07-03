'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { CATEGORIES_CONFIG } from '@/lib/categories.config';

interface Props { shopId: string; currentCategory: string }

export function CategoryOverride({ shopId, currentCategory }: Props) {
  const router = useRouter();
  const [selected, setSelected]   = useState(currentCategory);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [pending, start]          = useTransition();

  const handleSave = () => {
    if (selected === currentCategory) return;
    setError('');
    start(async () => {
      const res = await fetch('/api/admin/set-shop-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, category: selected }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to update');
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CATEGORIES_CONFIG.map(cat => (
          <button
            key={cat.value}
            onClick={() => { setSelected(cat.value); setSaved(false); }}
            className={`text-left px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
              selected === cat.value
                ? 'border-emerald-500 bg-emerald-600/10 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending || selected === currentCategory}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? <><Loader2 size={13} className="animate-spin" /> Saving…</> :
           saved   ? <><Check size={13} /> Saved!</> : 'Update Category'}
        </button>
        {saved && <p className="text-xs text-emerald-400">✓ Category updated. Products panel will change for this shop.</p>}
      </div>
    </div>
  );
}
