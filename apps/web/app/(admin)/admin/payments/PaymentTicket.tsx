'use client';

import { useState, useTransition } from 'react';
import { Check, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const METHOD_META: Record<string, { label: string; logo: string; color: string }> = {
  bkash:  { label: 'bKash',  logo: '💳', color: '#e2136e' },
  nagad:  { label: 'Nagad',  logo: '💰', color: '#f7941d' },
  rocket: { label: 'Rocket', logo: '🚀', color: '#8b5cf6' },
  card:   { label: 'Card',   logo: '🌍', color: '#06b6d4' },
};

const PLAN_COLORS: Record<string, string> = {
  trial:    '#9ca3af', starter: '#10b981', pro: '#06b6d4', business: '#f59e0b',
};

interface Request {
  id: string;
  shop_id: string;
  plan_id: string;
  amount: number;
  method: string;
  phone_last4: string;
  transaction_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  created_at: string;
  shops?: { name: string };
}

export function PaymentTicket({ request: r }: { request: Request }) {
  const router             = useRouter();
  const [expanded, setExp] = useState(r.status === 'pending');
  const [note, setNote]    = useState('');
  const [processing, start] = useTransition();

  const date = new Date(r.created_at);
  const meta = METHOD_META[r.method] ?? METHOD_META.bkash;
  const planColor = PLAN_COLORS[r.plan_id] ?? '#9ca3af';

  const action = async (decision: 'approved' | 'rejected') => {
    start(async () => {
      await fetch('/api/admin/review-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id, decision, note, shopId: r.shop_id, planId: r.plan_id }),
      });
      router.refresh();
    });
  };

  const statusBadge = {
    pending:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
  }[r.status];

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      r.status === 'pending' ? 'border-amber-500/30 bg-gray-900' : 'border-gray-800 bg-gray-900'
    }`}>
      {/* Ticket header */}
      <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
        onClick={() => setExp(!expanded)}>
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-2xl shrink-0">{meta.logo}</span>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{r.shops?.name ?? r.shop_id.slice(0,8)}</span>
              <span className="text-sm font-semibold" style={{ color: planColor }}>→ {r.plan_id} plan</span>
              <span className="text-sm font-bold text-white">৳{r.amount.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {meta.label} · xxxx-{r.phone_last4} · TXN: {r.transaction_id} · {date.toLocaleDateString('en', { day:'numeric', month:'short' })} {date.toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-full border ${statusBadge}`}>
            {r.status}
          </span>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Method',         value: meta.label },
              { label: 'Phone (last 4)', value: `xxxx-${r.phone_last4}` },
              { label: 'Transaction ID', value: r.transaction_id, mono: true },
              { label: 'Amount',         value: `৳${r.amount.toLocaleString()}` },
            ].map(({ label, value, mono }) => (
              <div key={label} className="bg-gray-800 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-sm font-semibold text-white ${mono ? 'font-mono' : ''}`}>{value}</p>
              </div>
            ))}
          </div>

          {r.status === 'pending' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Note to merchant (optional)</label>
                <input
                  value={note} onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Approved! Plan activated. or Transaction not found, please resubmit."
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => action('approved')} disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all disabled:opacity-50">
                  {processing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve & Activate
                </button>
                <button onClick={() => action('rejected')} disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-bold border border-red-600/30 transition-all disabled:opacity-50">
                  {processing ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Reject
                </button>
              </div>
            </>
          )}

          {r.admin_note && (
            <div className={`text-xs px-3 py-2 rounded-lg ${
              r.status === 'approved' ? 'bg-emerald-600/15 text-emerald-400' : 'bg-red-600/15 text-red-400'
            }`}>
              Admin note: {r.admin_note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
