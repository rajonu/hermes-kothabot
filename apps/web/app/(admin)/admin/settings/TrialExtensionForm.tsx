'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check, Calendar } from 'lucide-react';

export function TrialExtensionForm({ shops }: { shops: any[] }) {
  const [selectedShop, setSelectedShop] = useState('');
  const [newPlan,  setNewPlan]   = useState('trial');
  const [days,     setDays]      = useState(14);
  const [saving,   startSave]    = useTransition();
  const [saved,    setSaved]     = useState(false);
  const [error,    setError]     = useState('');

  const handleSave = () => {
    if (!selectedShop) { setError('Select a shop'); return; }
    setError('');
    startSave(async () => {
      const res = await fetch('/api/admin/extend-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: selectedShop, planId: newPlan, days }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else { const d = await res.json(); setError(d.error ?? 'Failed'); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Shop */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Shop</label>
          <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-emerald-500">
            <option value="">Choose a shop…</option>
            {shops.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.subscriptions?.[0]?.plan_id ?? 'trial'})
              </option>
            ))}
          </select>
        </div>

        {/* Plan */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Set Plan</label>
          <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-emerald-500">
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Days */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Add Days</label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-emerald-500" />
          </div>
        </div>
      </div>

      {/* Preview */}
      {selectedShop && (
        <div className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
          Will activate <strong className="text-white capitalize">{newPlan}</strong> plan for{' '}
          <strong className="text-white">{shops.find(s => s.id === selectedShop)?.name}</strong> for{' '}
          <strong className="text-emerald-400">{days} days</strong> from today.
        </div>
      )}

      {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50">
        {saving ? <><Loader2 size={14} className="animate-spin" />Updating…</> :
         saved  ? <><Check size={14} />Done!</> :
                  'Apply Subscription'}
      </button>
    </div>
  );
}
