'use client';

import { useState } from 'react';
import { Loader2, Check, Shield } from 'lucide-react';

interface Props {
  initialEnabled: boolean;
}

export function VoiceProtectionForm({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/admin/settings/voice-protection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        When enabled, users opening voice links from Facebook, Messenger, or Instagram will see a
        modal guiding them to open the page in Chrome (Android) or Safari (iOS) for proper microphone access.
      </p>

      <div className="flex items-center gap-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
        </label>
        <span className="text-sm text-gray-300">
          {enabled ? (
            <span className="text-emerald-400 font-semibold">Enabled</span>
          ) : (
            <span className="text-gray-500">Disabled</span>
          )}
        </span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <><Loader2 size={14} className="animate-spin" /> Saving…</>
        ) : saved ? (
          <><Check size={14} /> Saved!</>
        ) : (
          <><Shield size={14} /> Save Setting</>
        )}
      </button>
    </div>
  );
}
