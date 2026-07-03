'use client';

import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface Request {
  id: string;
  plan_id: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  created_at: string;
}

const METHOD_LOGOS: Record<string, string> = { bkash: '💳', nagad: '💰', rocket: '🚀', card: '🌍' };
const PLAN_COLORS: Record<string, string>  = { trial: '#9ca3af', starter: '#10b981', pro: '#06b6d4', business: '#f59e0b' };

export function SubmittedRequests({ requests }: { requests: Request[] }) {
  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden mt-2">
      <div className="px-5 py-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Payment Requests</h2>
        <p className="text-xs text-gray-400 mt-0.5">Track the status of your payment submissions</p>
      </div>
      <div className="divide-y divide-gray-700">
        {requests.map(r => {
          const date = new Date(r.created_at);
          const color = PLAN_COLORS[r.plan_id] ?? '#9ca3af';
          return (
            <div key={r.id} className="flex items-start justify-between px-5 py-4 gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-xl mt-0.5 shrink-0">{METHOD_LOGOS[r.method] ?? '💳'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white capitalize">{r.plan_id} Plan</span>
                    <span className="text-xs font-semibold" style={{ color }}>৳{r.amount.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-500 capitalize">{r.method}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Submitted {date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} at {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {r.admin_note && (
                    <p className={`text-xs mt-1.5 px-2.5 py-1.5 rounded-lg ${
                      r.status === 'approved' ? 'bg-emerald-600/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      Admin: {r.admin_note}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {r.status === 'pending' && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1.5 rounded-full">
                    <Clock size={11} /> Under Review
                  </span>
                )}
                {r.status === 'approved' && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1.5 rounded-full">
                    <CheckCircle size={11} /> Approved
                  </span>
                )}
                {r.status === 'rejected' && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-1.5 rounded-full">
                    <XCircle size={11} /> Rejected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
