'use client';

import { useState } from 'react';

interface Props {
  shopId: string;
  planId: string;
  callLimit: number;
  callsUsed: number;
  minutesUsed: number;
  extraCalls: number;
  extraMinutes: number;
  subscriptionId: string;
}

export function UsagePanel({
  planId,
  callLimit,
  callsUsed,
  minutesUsed,
  extraCalls,
  extraMinutes,
  subscriptionId,
}: Props) {
  const [localCallsUsed, setLocalCallsUsed]       = useState(callsUsed);
  const [localMinutesUsed, setLocalMinutesUsed]   = useState(minutesUsed);
  const [localExtraCalls, setLocalExtraCalls]     = useState(extraCalls);
  const [localExtraMinutes, setLocalExtraMinutes] = useState(extraMinutes);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalCallsAllowed = callLimit === -1 ? Infinity : callLimit + localExtraCalls;
  const callPercent = callLimit === -1
    ? 0
    : Math.min(100, Math.round((localCallsUsed / totalCallsAllowed) * 100));

  async function adjust(field: 'extra_calls' | 'extra_minutes', amount: number) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/usage/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, field, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (field === 'extra_calls')   setLocalExtraCalls(data.extra_calls);
      if (field === 'extra_minutes') setLocalExtraMinutes(data.extra_minutes);
      setMessage(`Added ${amount} ${field === 'extra_calls' ? 'calls' : 'minutes'} successfully.`);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function resetUsage() {
    if (!confirm('Reset calls_used and minutes_used to 0 for this subscription?')) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/usage/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setLocalCallsUsed(0);
      setLocalMinutesUsed(0);
      setMessage('Usage reset successfully.');
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Call Usage Bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">Calls Used</span>
          <span className="text-xs text-white font-semibold">
            {localCallsUsed.toLocaleString()}
            {' / '}
            {callLimit === -1 ? 'Unlimited' : (callLimit + localExtraCalls).toLocaleString()}
            {localExtraCalls > 0 && (
              <span className="ml-1 text-emerald-400 text-[10px]">(+{localExtraCalls.toLocaleString()} extra)</span>
            )}
          </span>
        </div>
        {callLimit !== -1 && (
          <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                callPercent >= 90 ? 'bg-red-500' : callPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${callPercent}%` }}
            />
          </div>
        )}
        {callLimit === -1 && (
          <div className="text-[11px] text-cyan-400 font-semibold mt-1">Unlimited plan — no call cap</div>
        )}
      </div>

      {/* Minutes Used */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Minutes Used</span>
        <span className="text-xs text-white font-semibold">
          {localMinutesUsed.toLocaleString()} min
          {localExtraMinutes > 0 && (
            <span className="ml-1 text-emerald-400 text-[10px]">(+{localExtraMinutes.toLocaleString()} extra)</span>
          )}
        </span>
      </div>

      {/* Add Extra Calls */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-2">Add Extra Calls</p>
        <div className="flex flex-wrap gap-2">
          {[100, 500, 1000].map(amt => (
            <button
              key={amt}
              disabled={loading}
              onClick={() => adjust('extra_calls', amt)}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/25 transition-colors disabled:opacity-50"
            >
              +{amt.toLocaleString()} Calls
            </button>
          ))}
        </div>
      </div>

      {/* Add Extra Minutes */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-2">Add Extra Minutes</p>
        <div className="flex flex-wrap gap-2">
          {[100, 500, 1000].map(amt => (
            <button
              key={amt}
              disabled={loading}
              onClick={() => adjust('extra_minutes', amt)}
              className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600/15 text-cyan-400 border border-cyan-600/20 hover:bg-cyan-600/25 transition-colors disabled:opacity-50"
            >
              +{amt.toLocaleString()} Min
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div>
        <button
          disabled={loading}
          onClick={resetUsage}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600/15 text-red-400 border border-red-600/20 hover:bg-red-600/25 transition-colors disabled:opacity-50"
        >
          Reset Usage
        </button>
      </div>

      {message && (
        <p className={`text-xs px-3 py-2 rounded-lg ${
          message.startsWith('Error') ? 'bg-red-600/10 text-red-400' : 'bg-emerald-600/10 text-emerald-400'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}
