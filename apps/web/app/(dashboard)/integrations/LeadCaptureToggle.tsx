'use client';

import { useState } from 'react';
import { UserPlus, Shield } from 'lucide-react';

interface Props {
  initialRequirePhone: boolean;
}

export function LeadCaptureToggle({ initialRequirePhone }: Props) {
  const [requirePhone, setRequirePhone] = useState(initialRequirePhone);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function toggle() {
    const next = !requirePhone;
    setRequirePhone(next);
    setSaving(true);
    try {
      const res = await fetch('/api/shops/widget-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirePhone: next }),
      });
      if (!res.ok) {
        setRequirePhone(!next); // revert
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setRequirePhone(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                Lead Capture
                {savedAt && Date.now() - savedAt < 3000 && (
                  <span className="text-[10px] text-emerald-400 font-normal">✓ Saved</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Require visitors to enter their phone number before they can start a voice call or chat.
                Captures every visitor as a lead — even if they don&apos;t order. Protects against spam and bots.
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                requirePhone ? 'bg-emerald-600' : 'bg-gray-600'
              }`}
              aria-label="Toggle lead capture"
            >
              <span
                className={`inline-block h-5 w-5 bg-white rounded-full shadow transform transition-transform ${
                  requirePhone ? 'translate-x-5' : 'translate-x-0.5'
                }`}
                style={{ marginTop: 2 }}
              />
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2 text-[11px] text-gray-500">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Captured numbers appear in your <a href="/leads" className="text-emerald-400 hover:underline">Leads</a> page.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
