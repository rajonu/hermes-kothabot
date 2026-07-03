'use client';

import { useState } from 'react';

interface Integration {
  id: string;
  shop_id: string;
  google_email: string;
  connected_at: string;
  last_sync_at: string | null;
  auto_sync: boolean;
  events_created: number;
  events_updated: number;
  events_cancelled: number;
  sync_errors: number;
  shops?: { name: string; category: string };
}

export function AdminCalendarClient({ integrations }: { integrations: Integration[] }) {
  const [list, setList] = useState(integrations);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  async function disconnect(shopId: string) {
    if (!confirm('Force-disconnect this client\'s Google Calendar?')) return;
    setDisconnecting(shopId);
    await fetch('/api/admin/calendar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shopId }),
    });
    setList(prev => prev.filter(i => i.shop_id !== shopId));
    setDisconnecting(null);
  }

  if (!list.length) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
        <p className="text-gray-500 text-sm">No clients have connected Google Calendar yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map(i => (
        <div key={i.id} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">{i.shops?.name ?? i.shop_id.slice(0, 8)}</span>
              <span className="text-[10px] text-gray-500 uppercase bg-gray-800 px-1.5 py-0.5 rounded">{i.shops?.category}</span>
            </div>
            <p className="text-xs text-gray-400">{i.google_email}</p>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
            <div className="text-center">
              <p className="text-white font-semibold">{i.events_created}</p>
              <p>created</p>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">{i.events_updated}</p>
              <p>updated</p>
            </div>
            <div className={`text-center ${i.sync_errors > 0 ? 'text-red-400' : ''}`}>
              <p className="font-semibold">{i.sync_errors}</p>
              <p>errors</p>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex-shrink-0 text-right">
            {i.last_sync_at ? (
              <>
                <p className="text-gray-400">Last sync</p>
                <p>{new Date(i.last_sync_at).toLocaleDateString()}</p>
              </>
            ) : (
              <p>Never synced</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${i.auto_sync ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {i.auto_sync ? 'AUTO' : 'PAUSED'}
            </span>
            <button
              onClick={() => disconnect(i.shop_id)}
              disabled={disconnecting === i.shop_id}
              className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {disconnecting === i.shop_id ? '…' : 'Disconnect'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
