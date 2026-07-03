'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface WhatsAppStatus {
  connected: boolean;
  phone?: string;
  connected_at?: string;
  last_error?: string | null;
}

export function WhatsAppPanel({ shopId }: { shopId: string }) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`shop:${shopId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'wa_qr' }, ({ payload }) => {
        setQr(payload?.qr ?? null);
      })
      .on('broadcast', { event: 'wa_connected' }, ({ payload }) => {
        setQr(null);
        setConnecting(false);
        setStatus({ connected: true, phone: payload?.phone, connected_at: new Date().toISOString() });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  async function loadStatus() {
    setLoading(true);
    const res = await fetch('/api/integrations/whatsapp/status');
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }

  async function connect() {
    setConnecting(true);
    setQr(null);
    const res = await fetch('/api/integrations/whatsapp/connect', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Failed to start WhatsApp pairing');
      setConnecting(false);
    }
    // QR + connected events arrive via Realtime broadcast above.
  }

  async function disconnect() {
    if (!confirm('Disconnect WhatsApp? Your linked phone will be logged out.')) return;
    setDisconnecting(true);
    await fetch('/api/integrations/whatsapp/disconnect', { method: 'POST' });
    setStatus({ connected: false });
    setQr(null);
    setDisconnecting(false);
  }

  if (loading) return <div className="text-gray-400 text-sm py-4">Loading WhatsApp status…</div>;

  return (
    <div className={`rounded-2xl border p-5 ${status?.connected ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#25D366]">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.94.55 3.83 1.59 5.46L2 22l4.79-1.66a9.84 9.84 0 005.25 1.5h.01c5.46 0 9.91-4.45 9.91-9.91C22 6.47 17.5 2 12.04 2zm5.84 14.09c-.25.71-1.45 1.35-2 1.43-.51.08-1.15.11-1.86-.12-.43-.13-.98-.31-1.68-.61-2.96-1.28-4.89-4.26-5.04-4.46-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .39 0 .56.01.18.01.42-.07.66.5.25.6.84 2.06.91 2.21.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.54-.15.15-.3.31-.13.61.18.3.8 1.32 1.72 2.14 1.18 1.05 2.18 1.38 2.48 1.53.3.15.48.13.66-.05.18-.18.76-.89.97-1.19.2-.3.4-.25.66-.15.27.1 1.7.8 1.99.95.3.15.49.22.56.35.07.13.07.74-.18 1.45z"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white">WhatsApp</h3>
            {status?.connected ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">CONNECTED</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">NOT CONNECTED</span>
            )}
          </div>

          {status?.connected ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Linked number <span className="text-white font-medium">{status.phone}</span></p>
              {status.connected_at && (
                <p className="text-xs text-gray-500">Connected: {new Date(status.connected_at).toLocaleString()}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Link your WhatsApp number so customers can message your AI assistant there.</p>
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
            <button
              onClick={connect}
              disabled={connecting}
              className="px-4 py-2 bg-[#25D366] hover:bg-[#21bd5c] text-white text-sm font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              {connecting ? 'Starting…' : 'Link Device'}
            </button>
          )}
        </div>
      </div>

      {qr && !status?.connected && (
        <div className="mt-4 rounded-xl p-4 bg-white flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="WhatsApp QR code" className="w-48 h-48" />
          <p className="text-xs text-gray-600">Scan with WhatsApp → Linked Devices → Link a Device</p>
        </div>
      )}

      {status?.connected && status.last_error && (
        <div className="mt-4 rounded-xl p-3 bg-red-900/20 border border-red-700/40">
          <p className="text-xs font-semibold text-red-400 mb-1">⚠️ WhatsApp connection issue</p>
          <p className="text-xs text-red-300/80 font-mono break-all">{status.last_error}</p>
        </div>
      )}
    </div>
  );
}
