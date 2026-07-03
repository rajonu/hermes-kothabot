'use client';

import { useState } from 'react';

interface ApiKey {
  id: string;
  shop_id: string;
  name: string;
  key_prefix: string;
  type: 'test' | 'live';
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
  shops?: { name: string };
}

interface LogEntry {
  shop_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number | null;
  created_at: string;
}

export function AdminApiClient({
  initialKeys,
  recentLogs,
}: {
  initialKeys: ApiKey[];
  recentLogs: LogEntry[];
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [tab, setTab] = useState<'keys' | 'logs'>('keys');
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleKey(id: string, currentActive: boolean) {
    setToggling(id);
    await fetch('/api/admin/api-keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !currentActive }),
    });
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: !currentActive } : k));
    setToggling(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('keys')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'keys' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          API Keys ({keys.length})
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'logs' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Request Logs ({recentLogs.length})
        </button>
      </div>

      {tab === 'keys' && (
        <div className="space-y-2">
          {keys.map(k => (
            <div
              key={k.id}
              className={`flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 border ${k.is_active ? 'border-gray-800' : 'border-red-900/40'}`}
            >
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${k.type === 'live' ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-300'}`}>
                {k.type.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">{k.shops?.name ?? k.shop_id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-500">· {k.name}</span>
                </div>
                <span className="font-mono text-xs text-gray-500">{k.key_prefix}…</span>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <div>{k.request_count.toLocaleString()} req</div>
                {k.last_used_at && <div>{new Date(k.last_used_at).toLocaleDateString()}</div>}
              </div>
              <button
                onClick={() => toggleKey(k.id, k.is_active)}
                disabled={toggling === k.id}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  k.is_active
                    ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                    : 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'
                } disabled:opacity-50`}
              >
                {toggling === k.id ? '…' : k.is_active ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-4">Time</th>
                <th className="text-left py-2 pr-4">Method</th>
                <th className="text-left py-2 pr-4">Endpoint</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {recentLogs.map((l, i) => (
                <tr key={i} className="hover:bg-gray-900/50">
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${l.method === 'GET' ? 'bg-blue-800 text-white' : 'bg-emerald-800 text-white'}`}>
                      {l.method}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-300">{l.endpoint}</td>
                  <td className="py-2 pr-4">
                    <span className={`font-mono ${l.status_code >= 400 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {l.status_code}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">{l.duration_ms ? `${l.duration_ms}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentLogs.length === 0 && <p className="text-gray-500 text-sm py-4">No recent API requests.</p>}
        </div>
      )}
    </div>
  );
}
