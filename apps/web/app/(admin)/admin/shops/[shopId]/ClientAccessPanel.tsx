'use client';

import { useState, useTransition } from 'react';
import { Key, Link2, Loader2, Copy, Check, RefreshCw } from 'lucide-react';

interface Props {
  shopId: string;
  ownerEmail: string;
}

export function ClientAccessPanel({ shopId, ownerEmail }: Props) {
  const [accessLink, setAccessLink]   = useState('');
  const [copied, setCopied]           = useState(false);
  const [resetSent, setResetSent]     = useState(false);
  const [error, setError]             = useState('');
  const [resetPending, startReset]    = useTransition();
  const [linkPending, startLink]      = useTransition();

  const handleReset = () => {
    setError(''); setResetSent(false);
    startReset(async () => {
      const res = await fetch('/api/admin/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });
      if (res.ok) { setResetSent(true); }
      else { const d = await res.json(); setError(d.error ?? 'Failed'); }
    });
  };

  const handleGenerateLink = () => {
    setError(''); setAccessLink(''); setCopied(false);
    startLink(async () => {
      const res = await fetch('/api/admin/generate-access-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });
      const d = await res.json();
      if (res.ok) { setAccessLink(d.link); }
      else { setError(d.error ?? 'Failed to generate link'); }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(accessLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700">
        <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0">
          {ownerEmail[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Account email</p>
          <p className="text-sm font-medium text-white truncate">{ownerEmail}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleReset}
          disabled={resetPending || resetSent}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/15 border border-amber-600/20 text-amber-400 hover:bg-amber-600/25 text-xs font-semibold transition-all disabled:opacity-60"
        >
          {resetPending ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
          {resetSent ? '✓ Reset email sent!' : 'Send Password Reset Email'}
        </button>

        <button
          onClick={handleGenerateLink}
          disabled={linkPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/15 border border-cyan-600/20 text-cyan-400 hover:bg-cyan-600/25 text-xs font-semibold transition-all disabled:opacity-60"
        >
          {linkPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          Generate One-Time Login Link
        </button>
      </div>

      {accessLink && (
        <div className="rounded-xl border border-cyan-600/20 bg-cyan-600/5 p-4 space-y-2">
          <p className="text-xs text-cyan-400 font-semibold flex items-center gap-1.5">
            <Link2 size={12} /> One-Time Access Link — expires in 1 hour
          </p>
          <p className="text-[10px] text-gray-500">Open in an incognito window to access their account without affecting your admin session.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] font-mono text-gray-300 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700 truncate">
              {accessLink}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
            >
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <button onClick={handleGenerateLink} disabled={linkPending} className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
            <RefreshCw size={10} /> Regenerate
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <p className="text-[11px] text-gray-600">
        The login link logs into their account directly — use incognito so your admin session stays separate.
      </p>
    </div>
  );
}
