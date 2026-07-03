'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check } from 'lucide-react';

interface Props {
  shopId: string;
  flag: 'voip_enabled' | 'api_access_enabled' | 'white_label';
  enabled: boolean;
  label: string;
  description: string;
}

export function FeatureToggle({ shopId, flag, enabled: initial, label, description }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSaved(false);
    startSave(async () => {
      await fetch('/api/admin/set-shop-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, flag, enabled: next }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {saving && <Loader2 size={14} className="animate-spin text-gray-400" />}
        {saved && <Check size={14} className="text-emerald-400" />}
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-600' : 'bg-gray-700'} disabled:opacity-50`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}
