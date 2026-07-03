'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const PIN_LENGTH = 6;

export function PinForm() {
  const router             = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [show,   setShow]   = useState(false);
  const [error,  setError]  = useState('');
  const [locked, setLocked] = useState(false);
  const [lockMins, setLockMins] = useState(0);
  const [submitting, start] = useTransition();
  const inputRefs            = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInput = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[i] = digit;
    setDigits(next);
    setError('');

    if (digit && i < PIN_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus();
    }
    // Auto-submit when all filled
    if (digit && i === PIN_LENGTH - 1) {
      const pin = next.join('');
      if (pin.length === PIN_LENGTH) submitPin(pin);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = '';
      setDigits(next);
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const pin = digits.join('');
      if (pin.length === PIN_LENGTH) submitPin(pin);
    }
  };

  const submitPin = (pin: string) => {
    if (locked) return;
    start(async () => {
      const res  = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else if (res.status === 429) {
        setLocked(true);
        setLockMins(data.remainingMins ?? 15);
        setError(`Too many attempts. Locked for ${data.remainingMins} minutes.`);
      } else {
        setError(data.error ?? 'Incorrect PIN');
        setDigits(Array(PIN_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    });
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-6">
      {/* PIN input boxes */}
      <div className="flex gap-2 justify-center">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={locked || submitting}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-gray-800 text-white transition-all focus:outline-none ${
              error
                ? 'border-red-500 bg-red-500/10'
                : d
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-gray-700 focus:border-emerald-500'
            } disabled:opacity-50`}
          />
        ))}
      </div>

      {/* Show/hide + submit */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setShow(!show)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
          {show ? 'Hide' : 'Show'} PIN
        </button>

        <button
          onClick={() => { const p = digits.join(''); if (p.length === PIN_LENGTH) submitPin(p); }}
          disabled={digits.join('').length < PIN_LENGTH || submitting || locked}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all disabled:opacity-50"
        >
          {submitting ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : 'Enter Admin'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-center">
          <p className="text-sm text-red-400 font-semibold">{error}</p>
          {locked && <p className="text-xs text-red-500 mt-1">Wait {lockMins} minutes before trying again.</p>}
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        PIN is different from your login password.
      </p>
    </div>
  );
}
