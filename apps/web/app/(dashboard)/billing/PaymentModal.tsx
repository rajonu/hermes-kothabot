'use client';

import { useState, useTransition } from 'react';
import { X, Copy, Check, ChevronRight, Loader2 } from 'lucide-react';
import { methodsForRegion, type PaymentMethod, type PaymentMethodId } from '@/lib/platform-types';
import Image from 'next/image';

interface Props {
  planId: string;
  planName: string;
  amount: number;
  currency: 'BDT' | 'USD';
  shopId: string;
  shopName: string;
  paymentMethods: Record<PaymentMethodId, PaymentMethod>;
  lsCheckoutUrl: string | null; // legacy, kept for backwards compat
  color: string;
  disabled?: boolean;
  isBD: boolean;
  autoOpen?: boolean;
}

type Step = 'choose' | 'pay' | 'submit' | 'done';

const METHOD_META: Record<PaymentMethodId, { label: string; logo: string; color: string }> = {
  bkash:  { label: 'bKash',  logo: '💳', color: '#e2136e' },
  nagad:  { label: 'Nagad',  logo: '💰', color: '#f7941d' },
  rocket: { label: 'Rocket', logo: '🚀', color: '#8b5cf6' },
  paddle: { label: 'Card / PayPal (Paddle)', logo: '🧾', color: '#0ea5e9' },
};

export function PaymentModal({ planId, planName, amount, currency, shopId, shopName, paymentMethods, lsCheckoutUrl, color, disabled, isBD, autoOpen = false }: Props) {
  const region = isBD ? 'BD' : 'INTL';
  const available = methodsForRegion(paymentMethods, region);

  const [open, setOpen] = useState(autoOpen);
  // Pre-select first available method (if only one available, skip the choose step)
  const initialMethod = available[0]?.id ?? 'bkash';
  const [method, setMethod] = useState<PaymentMethodId>(initialMethod);
  const [step, setStep]     = useState<Step>(available.length <= 1 ? 'pay' : 'choose');
  const [phone4, setPhone4] = useState('');
  const [txnId, setTxnId]   = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [error, setError]   = useState('');

  const sym = currency === 'BDT' ? '৳' : '$';
  const displayAmount = currency === 'USD' ? (amount / 100).toFixed(2) : amount.toLocaleString();
  const currentMethod = paymentMethods[method];
  const meta = METHOD_META[method];
  const isPaddle = method === 'paddle';
  // Paddle URL precedence: method.checkout_url → legacy plan.ls_checkout_url
  const paddleUrl = currentMethod?.checkout_url ?? lsCheckoutUrl;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 2000);
  };

  const reset = () => {
    setStep(available.length <= 1 ? 'pay' : 'choose');
    setMethod(initialMethod); setPhone4(''); setTxnId(''); setError('');
  };
  const close = () => { setOpen(false); setTimeout(reset, 300); };

  const handleSubmit = () => {
    if (phone4.length !== 4 || !/^\d{4}$/.test(phone4)) { setError('Please enter the last 4 digits of your phone number'); return; }
    if (txnId.trim().length < 4) { setError('Please enter a valid transaction ID'); return; }
    setError('');
    startSubmit(async () => {
      const res = await fetch('/api/billing/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, planId, amount, method, phone_last4: phone4, transaction_id: txnId.trim() }),
      });
      if (res.ok) setStep('done');
      else { const d = await res.json(); setError(d.error ?? 'Submission failed. Please try again.'); }
    });
  };

  return (
    <>
      <button
        onClick={() => { if (!disabled) setOpen(true); }}
        disabled={disabled}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {disabled ? 'Payment Pending Review' : `Upgrade to ${planName}`}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={close}>
          <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-white">Upgrade to {planName}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{sym}{displayAmount}/month · {shopName}</p>
              </div>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"><X size={16} /></button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">

              {/* ── STEP: Choose method (only when multiple available) ── */}
              {step === 'choose' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 mb-4">Choose your payment method:</p>
                  {available.length === 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-4 text-center">
                      <p className="text-sm font-semibold text-amber-400">No payment methods available for your region</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        Please contact <span className="text-emerald-400 font-semibold">pay@kothabot.ai</span> to subscribe.
                      </p>
                    </div>
                  )}
                  {available.map(({ id }) => {
                    const mm = METHOD_META[id];
                    return (
                      <button
                        key={id}
                        onClick={() => { setMethod(id); setStep('pay'); }}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-700 bg-gray-800 hover:border-gray-500 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{mm.logo}</span>
                          <span className="text-sm font-semibold text-white">{mm.label}</span>
                        </div>
                        <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── STEP: Pay (PADDLE — external redirect) ── */}
              {step === 'pay' && isPaddle && (
                <div className="space-y-4">
                  {available.length > 1 && (
                    <button onClick={() => setStep('choose')} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">← Back</button>
                  )}
                  <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
                    <div className="text-3xl">{meta.logo}</div>
                    <div>
                      <p className="text-sm font-bold text-white">Paddle Checkout</p>
                      <p className="text-xs text-gray-400">Visa, Mastercard, PayPal, Apple Pay, Google Pay</p>
                    </div>
                  </div>

                  {paddleUrl ? (
                    <a
                      href={paddleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: color }}
                    >
                      Pay {sym}{displayAmount}/month →
                    </a>
                  ) : (
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-4 text-center space-y-2">
                      <p className="text-sm font-semibold text-cyan-400">⚙ Checkout coming soon</p>
                      <p className="text-xs text-gray-400">
                        Email <span className="text-emerald-400 font-semibold">pay@kothabot.ai</span> to subscribe.
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">What you get</p>
                    <p className="text-xs text-gray-300">✓ Instant activation after payment</p>
                    <p className="text-xs text-gray-300">✓ VAT / tax handled automatically</p>
                    <p className="text-xs text-gray-300">✓ Cancel anytime from your billing portal</p>
                  </div>
                </div>
              )}

              {/* ── STEP: Pay (MANUAL mobile money) ── */}
              {step === 'pay' && !isPaddle && (
                <div className="space-y-4">
                  {available.length > 1 && (
                    <button onClick={() => setStep('choose')} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">← Back</button>
                  )}

                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Send this amount</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-white">{sym}{amount.toLocaleString()}</span>
                      <button onClick={() => copy(String(amount), 'amount')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                        {copied === 'amount' ? <><Check size={12} className="text-emerald-400" />Copied</> : <><Copy size={12} />Copy</>}
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Send to this {meta.label} number (Send Money)
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-bold" style={{ color: meta.color }}>{currentMethod?.number ?? 'N/A'}</span>
                      <button onClick={() => copy(currentMethod?.number ?? '', 'number')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                        {copied === 'number' ? <><Check size={12} className="text-emerald-400" />Copied</> : <><Copy size={12} />Copy</>}
                      </button>
                    </div>
                    {currentMethod?.qr_url && (
                      <div className="mt-4 flex flex-col items-center gap-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest self-start">Or scan QR code</p>
                        <div className="bg-white rounded-2xl p-3 shadow-lg">
                          <Image src={currentMethod.qr_url} alt="QR Code" width={200} height={200} className="rounded-lg" unoptimized />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setStep('submit')}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{ background: color }}
                  >
                    I've sent the payment →
                  </button>
                </div>
              )}

              {/* ── STEP: Submit proof ── */}
              {step === 'submit' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('pay')} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">← Back</button>

                  <div className="bg-emerald-600/10 border border-emerald-600/20 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-white">Confirm Your Payment</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {meta.logo} {sym}{amount.toLocaleString()} via {meta.label}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Last 4 digits of your phone number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text" maxLength={4} inputMode="numeric" pattern="[0-9]*"
                      value={phone4} onChange={e => setPhone4(e.target.value.replace(/\D/g,'').slice(0,4))}
                      placeholder="e.g. 5678"
                      className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-center text-2xl font-mono tracking-widest"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">The phone number you sent the payment from</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Transaction ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text" value={txnId} onChange={e => setTxnId(e.target.value)}
                      placeholder="e.g. 8ABC123456"
                      className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono uppercase"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Found in your {meta.label} transaction history</p>
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    onClick={handleSubmit} disabled={submitting}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: color }}
                  >
                    {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit for Verification'}
                  </button>

                  <p className="text-[11px] text-gray-500 text-center">
                    Our team reviews within 24 hours. You'll see the status below.
                  </p>
                </div>
              )}

              {/* ── STEP: Done ── */}
              {step === 'done' && (
                <div className="text-center py-6">
                  <div className="text-5xl mb-4">✅</div>
                  <h4 className="text-base font-bold text-white mb-2">Payment Submitted!</h4>
                  <p className="text-sm text-gray-400 mb-1">
                    We've received your payment request for <strong className="text-white">{planName}</strong>.
                  </p>
                  <p className="text-xs text-gray-500 mb-6">
                    Our team will verify and activate your plan within 24 hours.
                  </p>
                  <button onClick={close} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors">
                    Done
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
