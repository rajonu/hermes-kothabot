'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router                      = useRouter();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');
  const [pending, start]            = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    start(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message);
      } else {
        setDone(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#09110e]">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Image src="/kotha-logo.png" alt="KothaBot" width={40} height={40} className="rounded-xl" />
          <span className="text-xl font-bold text-[#e8f5e9]">KothaBot</span>
        </div>

        <div className="rounded-2xl border border-[#1e3d2c] bg-[#0f1f18] p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={26} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-[#e8f5e9] mb-2">Password updated!</h2>
              <p className="text-sm text-[#7a9e88]">Redirecting you to dashboard…</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-[#e8f5e9] mb-1">Set new password</h1>
              <p className="text-sm text-[#7a9e88] mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Minimum 8 characters"
                      className="w-full pr-10 px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a5e48] hover:text-[#7a9e88]">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Confirm password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00e676] text-[#09110e] font-semibold text-sm hover:bg-[#00e676]/90 disabled:opacity-60 transition-colors"
                >
                  {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
