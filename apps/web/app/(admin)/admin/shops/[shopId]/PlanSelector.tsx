'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';

const PLANS = [
  { id: 'trial',    label: 'Trial',    price: 'Free',     color: '#9ca3af', features: ['14 days', '30 calls / 30 min', 'Email support'] },
  { id: 'starter',  label: 'Starter',  price: '৳999/mo',  color: '#10b981', features: ['500 calls/mo', 'All models', 'Priority support'] },
  { id: 'pro',      label: 'Pro',      price: '৳2499/mo', color: '#06b6d4', features: ['2000 calls/mo', 'Custom voice', 'Dedicated support'] },
  { id: 'business', label: 'Business', price: '৳5999/mo', color: '#f59e0b', features: ['Unlimited calls', 'White label', 'SLA guarantee'] },
] as const;

type PlanId = typeof PLANS[number]['id'];

interface Props {
  shopId: string;
  currentPlan: PlanId;
  expiresAt?: string | null;
  /** extra_calls from subscriptions row (negative = reduced from plan default) */
  extraCalls?: number;
  /** extra_minutes from subscriptions row */
  extraMinutes?: number;
  /** Current trial plan call_limit from platform settings (authoritative default) */
  planCallLimit: number;
  /** Current trial plan minute_limit from platform settings */
  planMinuteLimit: number;
}

export function PlanSelector({
  shopId,
  currentPlan,
  expiresAt,
  extraCalls = 0,
  extraMinutes = 0,
  planCallLimit,
  planMinuteLimit,
}: Props) {
  const router                  = useRouter();
  const [selected, setSelected] = useState<PlanId>(currentPlan);
  const [saving, startSave]     = useTransition();
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // Restore saved values: actual_limit = plan_default + extra
  const [callLimit, setCallLimit]     = useState<string>(String(Math.max(1, planCallLimit + extraCalls)));
  const [minuteLimit, setMinuteLimit] = useState<string>(String(Math.max(1, planMinuteLimit + extraMinutes)));

  const handleSave = () => {
    setError('');
    startSave(async () => {
      const body: any = { shopId, plan: selected };
      if (selected === 'trial') {
        const c = parseInt(callLimit);
        const m = parseInt(minuteLimit);
        if (!isNaN(c) && c > 0) body.callLimitOverride   = c;
        if (!isNaN(m) && m > 0) body.minuteLimitOverride = m;
      }
      const res = await fetch('/api/admin/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        router.refresh();
      } else {
        setError(data.error ?? 'Update failed');
      }
    });
  };

  return (
    <div className="space-y-4">
      {expiresAt && (
        <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
          ⚠ Current plan expires: {new Date(expiresAt).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {PLANS.map(plan => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => { setSelected(plan.id); setSaved(false); setError(''); }}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                isSelected ? 'border-emerald-500 bg-emerald-600/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: plan.color }}>{plan.label}</span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <p className="text-base font-bold text-white mb-2">{plan.price}</p>
              <ul className="space-y-0.5">
                {plan.features.map(f => (
                  <li key={f} className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {selected === 'trial' && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Call Limit <span className="text-gray-500">(default: {planCallLimit})</span>
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={callLimit}
                onChange={e => setCallLimit(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Minute Limit <span className="text-gray-500">(default: {planMinuteLimit})</span>
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={minuteLimit}
                onChange={e => setMinuteLimit(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            Trial blocks new calls when <strong>either</strong> the call count <strong>or</strong> talk-time minutes is reached — whichever comes first.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">
          ❌ {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Updating…</> :
           saved  ? <><Check size={14} /> Updated!</> : 'Update Plan'}
        </button>
        {saved && <p className="text-xs text-emerald-400">✓ Plan changed to <strong>{selected}</strong>. Page refreshed.</p>}
      </div>
    </div>
  );
}
