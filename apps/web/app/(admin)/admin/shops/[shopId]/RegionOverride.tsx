'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check } from 'lucide-react';

type Region = 'BD' | 'INTL';

interface Props {
  shopId: string;
  currentRegion: Region;
}

const OPTIONS: { id: Region; label: string; flag: string; desc: string }[] = [
  { id: 'BD',   label: 'Bangladesh',    flag: '🇧🇩', desc: 'BDT pricing · bKash / Nagad / Rocket' },
  { id: 'INTL', label: 'Global',        flag: '🌍', desc: 'USD pricing · Paddle / Card' },
];

export function RegionOverride({ shopId, currentRegion }: Props) {
  const [selected, setSelected]   = useState<Region>(currentRegion === 'INTL' ? 'INTL' : 'BD');
  const [saving, startSave]       = useTransition();
  const [saved, setSaved]         = useState(false);

  const handleSave = () => {
    startSave(async () => {
      await fetch('/api/admin/set-shop-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, region: selected }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map(opt => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => { setSelected(opt.id); setSaved(false); }}
              className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-600/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{opt.flag}</span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <p className="text-sm font-bold text-white">{opt.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || selected === currentRegion}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> :
           saved  ? <><Check size={14} />Saved!</> :
                    'Save Region'}
        </button>
        {saved && (
          <p className="text-xs text-emerald-400">
            ✓ Region set to <strong>{selected}</strong>.
            Takes effect on next billing page visit.
          </p>
        )}
      </div>
    </div>
  );
}
