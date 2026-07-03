'use client';

import { useState, useEffect } from 'react';

interface FacebookStatus {
  connected: boolean;
  page_id?: string;
  page_name?: string;
  connected_at?: string;
  last_error?: string | null;
}

export function FacebookPanel() {
  const [status, setStatus] = useState<FacebookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    setLoading(true);
    const res = await fetch('/api/integrations/facebook/status');
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }

  async function disconnect() {
    if (!confirm('Disconnect Facebook Messenger? Customers will no longer reach your AI through your page.')) return;
    setDisconnecting(true);
    await fetch('/api/integrations/facebook/disconnect', { method: 'POST' });
    setStatus({ connected: false });
    setDisconnecting(false);
  }

  if (loading) return <div className="text-gray-400 text-sm py-4">Loading Facebook status…</div>;

  return (
    <div className={`rounded-2xl border p-5 ${status?.connected ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#1877F2]">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.87h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white">Facebook Messenger</h3>
            {status?.connected ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">CONNECTED</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">NOT CONNECTED</span>
            )}
          </div>

          {status?.connected ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Connected page <span className="text-white font-medium">{status.page_name}</span></p>
              {status.connected_at && (
                <p className="text-xs text-gray-500">Connected: {new Date(status.connected_at).toLocaleString()}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Connect your Facebook Page so customers can message your AI assistant on Messenger.</p>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {status?.connected ? (
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-lg border border-red-800/50 disabled:opacity-50"
            >
              {disconnecting ? '…' : 'Disconnect'}
            </button>
          ) : (
            <a
              href="/api/integrations/facebook/connect"
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              Connect Facebook Page
            </a>
          )}
        </div>
      </div>

      {status?.connected && status.last_error && (
        <div className="mt-4 rounded-xl p-3 bg-red-900/20 border border-red-700/40">
          <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Messenger connection issue</p>
          <p className="text-xs text-red-300/80 font-mono break-all">{status.last_error}</p>
        </div>
      )}
    </div>
  );
}
