'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

export function PushNotificationToggle() {
  const [status, setStatus] = useState<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('unsupported');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') { setStatus('denied'); return; }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    });
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set'); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
      });

      setStatus('subscribed');
    } catch (e) {
      console.error('Push subscribe failed', e);
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method:  'DELETE',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'unsupported') return null;

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <BellOff size={14} />
        Push notifications blocked — enable in browser settings
      </div>
    );
  }

  return (
    <button
      onClick={status === 'subscribed' ? disable : enable}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        status === 'subscribed'
          ? 'bg-emerald-600/15 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/25'
          : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {status === 'subscribed' ? <Bell size={15} /> : <BellOff size={15} />}
      {loading
        ? 'Working…'
        : status === 'subscribed'
        ? 'Push notifications on'
        : 'Enable push notifications'}
    </button>
  );
}

