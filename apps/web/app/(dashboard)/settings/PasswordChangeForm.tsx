'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';

export function PasswordChangeForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);
  const [pending, start]        = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Minimum 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    start(async () => {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setSaved(true);
        setPassword(''); setConfirm('');
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to update password');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-[#7a9e88]">New password</label>
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="text-xs text-[#3a5e48] hover:text-[#7a9e88] flex items-center gap-1">
            {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Confirm new password</label>
        <input
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat new password"
          className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 transition-colors"
        />
      </div>
      {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>}
      <button
        type="submit"
        disabled={pending || !password || !confirm}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00e676] text-[#09110e] font-semibold text-sm hover:bg-[#00e676]/90 disabled:opacity-50 transition-colors"
      >
        {pending ? <><Loader2 size={14} className="animate-spin" /> Updating…</> :
         saved   ? <><Check size={14} /> Updated!</> : 'Update Password'}
      </button>
    </form>
  );
}
