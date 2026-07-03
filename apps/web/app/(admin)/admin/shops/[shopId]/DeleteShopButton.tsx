'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  shopId: string;
  shopName: string;
}

export function DeleteShopButton({ shopId, shopName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=idle, 1=first confirm, 2=second confirm
  const [typedName, setTypedName] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const handleDelete = () => {
    setError('');
    start(async () => {
      const res = await fetch('/api/admin/delete-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, shopName }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        const d = await res.json();
        setError(d.error ?? 'Delete failed');
        setStep(0);
      }
    });
  };

  if (step === 0) {
    return (
      <button
        onClick={() => setStep(1)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/15 border border-red-600/30 text-red-400 hover:bg-red-600/25 text-xs font-semibold transition-all"
      >
        <Trash2 size={13} />
        Delete Client
      </button>
    );
  }

  if (step === 1) {
    return (
      <div className="rounded-xl border-2 border-red-600/40 bg-red-600/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Delete "{shopName}"?</p>
            <p className="text-xs text-gray-400 mt-1">
              This will permanently delete the shop, all orders, appointments, customers, voice sessions, training data, and the client's account. <strong className="text-red-400">This cannot be undone.</strong>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep(0)}
            className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => setStep(2)}
            className="flex-1 py-2 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 text-xs font-semibold transition-colors"
          >
            Yes, I understand — continue
          </button>
        </div>
      </div>
    );
  }

  // step === 2 — final confirmation: type shop name
  return (
    <div className="rounded-xl border-2 border-red-500 bg-red-600/10 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-red-500/30 flex items-center justify-center shrink-0 animate-pulse">
          <AlertTriangle size={16} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-red-300">Final confirmation</p>
          <p className="text-xs text-gray-400 mt-1">
            Type <strong className="text-white font-mono">{shopName}</strong> below to confirm permanent deletion.
          </p>
        </div>
      </div>

      <input
        type="text"
        value={typedName}
        onChange={e => setTypedName(e.target.value)}
        placeholder={`Type "${shopName}" to confirm`}
        className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-red-600/40 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors font-mono"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => { setStep(0); setTypedName(''); }}
          className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-xs font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={typedName !== shopName || pending}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : <><Trash2 size={13} /> Delete permanently</>}
        </button>
      </div>
    </div>
  );
}
