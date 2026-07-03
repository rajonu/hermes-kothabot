'use client';

import { useState, useTransition, useRef } from 'react';
import { Save, Loader2, Check, Upload, QrCode, X } from 'lucide-react';
import type { PaymentMethod, PaymentMethodId } from '@/lib/platform-types';
import Image from 'next/image';

type MethodsMap = Record<PaymentMethodId, PaymentMethod>;

interface Props { initialSettings: MethodsMap }

const METHODS: { id: PaymentMethodId; label: string; logo: string; color: string; manual: boolean }[] = [
  { id: 'bkash',  label: 'bKash',  logo: '💳', color: '#e2136e', manual: true  },
  { id: 'nagad',  label: 'Nagad',  logo: '💰', color: '#f7941d', manual: true  },
  { id: 'rocket', label: 'Rocket', logo: '🚀', color: '#8b5cf6', manual: true  },
  { id: 'paddle', label: 'Paddle', logo: '🧾', color: '#0ea5e9', manual: false },
];

const DEFAULT_REGIONS_BY_ID: Record<PaymentMethodId, ('BD'|'INTL')[]> = {
  bkash: ['BD'], nagad: ['BD'], rocket: ['BD'], paddle: ['BD', 'INTL'],
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PaymentSettingsForm({ initialSettings }: Props) {
  // Backfill defaults for legacy settings that lack `regions` / `checkout_url`.
  const seeded: MethodsMap = {
    bkash:  { ...initialSettings.bkash,  regions: initialSettings.bkash?.regions  ?? DEFAULT_REGIONS_BY_ID.bkash  },
    nagad:  { ...initialSettings.nagad,  regions: initialSettings.nagad?.regions  ?? DEFAULT_REGIONS_BY_ID.nagad  },
    rocket: { ...initialSettings.rocket, regions: initialSettings.rocket?.regions ?? DEFAULT_REGIONS_BY_ID.rocket },
    paddle: initialSettings.paddle ?? { number: '', qr_url: null, enabled: true, regions: DEFAULT_REGIONS_BY_ID.paddle, checkout_url: null },
  };
  const [settings, setSettings] = useState<MethodsMap>(seeded);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const update = (method: PaymentMethodId, field: keyof PaymentMethod, value: any) => {
    setSettings(prev => ({ ...prev, [method]: { ...prev[method], [field]: value } }));
    setSaved(false);
  };

  const toggleRegion = (method: PaymentMethodId, region: 'BD' | 'INTL') => {
    const current = settings[method].regions ?? DEFAULT_REGIONS_BY_ID[method];
    const next = current.includes(region) ? current.filter(r => r !== region) : [...current, region];
    update(method, 'regions', next);
  };

  const handleQrUpload = async (methodId: PaymentMethodId, file: File) => {
    if (file.size > 500 * 1024) { alert('QR image must be under 500 KB.'); return; }
    setUploading(methodId);
    try { update(methodId, 'qr_url', await fileToBase64(file)); } catch { alert('Failed to read file'); }
    setUploading(null);
  };

  const handleSave = () => {
    startSave(async () => {
      const res = await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'payment_methods', value: settings }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    });
  };

  return (
    <div className="space-y-4">
      {METHODS.map(m => {
        const method = settings[m.id];
        const regions = method.regions ?? DEFAULT_REGIONS_BY_ID[m.id];
        return (
          <div key={m.id} className="rounded-xl border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{m.logo}</span>
                <span className="text-sm font-bold" style={{ color: m.color }}>{m.label}</span>
                {!m.manual && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-700 text-white">CARD / GLOBAL</span>}
              </div>
              <button
                onClick={() => update(m.id, 'enabled', !method.enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${method.enabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${method.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Region selector */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Show in regions
              </label>
              <div className="flex gap-2">
                {(['BD', 'INTL'] as const).map(r => {
                  const active = regions.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRegion(m.id, r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {r === 'BD' ? '🇧🇩 Bangladesh' : '🌍 Global'}
                    </button>
                  );
                })}
              </div>
            </div>

            {m.manual ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Phone Number (Send Money)
                  </label>
                  <input
                    value={method.number}
                    onChange={e => update(m.id, 'number', e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    style={{ color: m.color }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    QR Code PNG (max 500 KB)
                  </label>
                  <div className="flex items-start gap-3">
                    <div>
                      <input
                        ref={el => { fileRefs.current[m.id] = el; }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleQrUpload(m.id, f); }}
                      />
                      <button
                        onClick={() => fileRefs.current[m.id]?.click()}
                        disabled={uploading === m.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-xs text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {uploading === m.id
                          ? <><Loader2 size={13} className="animate-spin" /> Reading…</>
                          : <><Upload size={13} /> {method.qr_url ? 'Replace QR' : 'Upload QR'}</>
                        }
                      </button>
                    </div>
                    {method.qr_url ? (
                      <div className="relative">
                        <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-emerald-500/40 bg-white">
                          <Image src={method.qr_url} alt={`${m.label} QR`} width={56} height={56} className="object-contain w-full h-full" unoptimized />
                        </div>
                        <button onClick={() => update(m.id, 'qr_url', null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors" title="Remove QR">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center shrink-0">
                        <QrCode size={20} className="text-gray-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Paddle Hosted Checkout URL
                </label>
                <input
                  type="url"
                  value={method.checkout_url ?? ''}
                  onChange={e => update(m.id, 'checkout_url', e.target.value || null)}
                  placeholder="https://pay.paddle.com/checkout/..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-sm font-mono text-cyan-400 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-gray-500 mt-1.5">
                  Paste your Paddle product checkout URL. Same URL handles BDT and USD via Paddle's locale settings.
                </p>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
      >
        {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> :
         saved  ? <><Check size={14} />Saved!</> :
                  <><Save size={14} />Save Payment Settings</>}
      </button>
    </div>
  );
}
