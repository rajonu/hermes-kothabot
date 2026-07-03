'use client';

import { useState, useTransition } from 'react';
import { Save, Loader2, Check, Plus, X } from 'lucide-react';
import type { PlatformPlan } from '@/lib/platform-types';

type Plans = Record<'trial' | 'starter' | 'pro' | 'business', PlatformPlan>;

const PLAN_COLORS = { trial: '#9ca3af', starter: '#10b981', pro: '#06b6d4', business: '#f59e0b' };
const PLAN_ORDER  = ['trial', 'starter', 'pro', 'business'] as const;

export function PlanSettingsForm({ initialPlans }: { initialPlans: Plans }) {
  const [plans, setPlans]     = useState<Plans>(initialPlans);
  const [saving, startSave]   = useTransition();
  const [saved, setSaved]     = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (planId: keyof Plans, field: keyof PlatformPlan, value: any) => {
    setPlans(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
    setSaved(false);
  };

  const addFeature = (planId: keyof Plans) => {
    const plan = plans[planId];
    update(planId, 'features', [...plan.features, '']);
  };

  const updateFeature = (planId: keyof Plans, idx: number, val: string) => {
    const features = [...plans[planId].features];
    features[idx] = val;
    update(planId, 'features', features);
  };

  const removeFeature = (planId: keyof Plans, idx: number) => {
    const features = plans[planId].features.filter((_, i) => i !== idx);
    update(planId, 'features', features);
  };

  const handleSave = () => {
    startSave(async () => {
      await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'plans', value: plans }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    });
  };

  return (
    <div className="space-y-3">
      {PLAN_ORDER.map(planId => {
        const plan  = plans[planId];
        const color = PLAN_COLORS[planId];
        const open  = expanded === planId;

        return (
          <div key={planId} className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
            {/* Plan header */}
            <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-750 transition-colors"
              onClick={() => setExpanded(open ? null : planId)}>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-sm font-bold text-white">{plan.name}</span>
                <span className="text-sm text-gray-400">
                  {plan.price === 0 ? 'Free' : `৳${plan.price.toLocaleString()}/mo`}
                </span>
              </div>
              <span className="text-xs text-gray-500">{open ? '▲ collapse' : '▼ edit'}</span>
            </button>

            {open && (
              <div className="px-4 pb-5 border-t border-gray-700 pt-4 space-y-4">
                {/* Row 1: Name + Period + Call Limit + Minute Limit */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Plan Name</label>
                    <input value={plan.name} onChange={e => update(planId, 'name', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Period (days)</label>
                    <input type="number" value={plan.period_days} onChange={e => update(planId, 'period_days', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Call Limit (-1=∞)</label>
                    <input type="number" value={plan.call_limit} onChange={e => update(planId, 'call_limit', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Minute Limit (-1=∞)</label>
                    <input type="number" value={(plan as any).minute_limit ?? plan.call_limit} onChange={e => update(planId, 'minute_limit' as any, Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>

                {/* Row 2: BDT + USD pricing */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">🇧🇩</span>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Price (BDT ৳)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">৳</span>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={e => update(planId, 'price', Number(e.target.value))}
                        disabled={planId === 'trial'}
                        placeholder="999"
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-emerald-400 font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">Shown to Bangladesh users</p>
                  </div>

                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">🌍</span>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Price (USD cents)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">¢</span>
                      <input
                        type="number"
                        value={(plan as any).price_usd ?? 0}
                        onChange={e => update(planId, 'price_usd' as any, Number(e.target.value))}
                        disabled={planId === 'trial'}
                        placeholder="999"
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-cyan-400 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-40"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      {((plan as any).price_usd ?? 0) > 0
                        ? `= $${(((plan as any).price_usd ?? 0) / 100).toFixed(2)} · Shown to international users`
                        : 'Enter in cents (e.g. 999 = $9.99)'}
                    </p>
                  </div>
                </div>

                {/* Lemon Squeezy URL */}
                {planId !== 'trial' && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                      🍋 Lemon Squeezy Checkout URL (optional — paste after setting up LS)
                    </label>
                    <input
                      type="url"
                      value={(plan as any).ls_checkout_url ?? ''}
                      onChange={e => update(planId, 'ls_checkout_url' as any, e.target.value || null)}
                      placeholder="https://yourstore.lemonsqueezy.com/checkout/buy/..."
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-xs text-gray-300 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Features */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Features</label>
                  <div className="space-y-2">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={f} onChange={e => updateFeature(planId, i, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:outline-none focus:border-emerald-500" />
                        <button onClick={() => removeFeature(planId, i)} className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addFeature(planId)}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                      <Plus size={13} /> Add feature
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50">
        {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> :
         saved  ? <><Check size={14} />Saved!</> :
                  <><Save size={14} />Save Plan Settings</>}
      </button>
    </div>
  );
}
