'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');
  const [pending, start]      = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    start(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) {
        setError(err.message);
      } else {
        setSent(true);
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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={26} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-[#e8f5e9] mb-2">Check your email</h2>
              <p className="text-sm text-[#7a9e88] leading-relaxed">
                We sent a password reset link to <strong className="text-white">{email}</strong>.<br />
                Click the link in the email to set a new password.
              </p>
              <p className="text-xs text-[#3a5e48] mt-4">Didn't get it? Check your spam folder.</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-[#e8f5e9] mb-1">Reset password</h1>
              <p className="text-sm text-[#7a9e88] mb-6">Enter your email and we'll send a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a5e48]" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00e676] text-[#09110e] font-semibold text-sm hover:bg-[#00e676]/90 disabled:opacity-60 transition-colors"
                >
                  {pending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          <div className="mt-5 pt-4 border-t border-[#1e3d2c]">
            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-[#7a9e88] hover:text-[#e8f5e9] transition-colors">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
