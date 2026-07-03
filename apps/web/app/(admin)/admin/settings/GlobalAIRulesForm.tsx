'use client';

import { useState } from 'react';
import { Loader2, Check, RotateCcw } from 'lucide-react';
import { DEFAULT_GLOBAL_AI_RULES } from '@/lib/ai-rules-default';

interface Props { initialRules: string; }

export function GlobalAIRulesForm({ initialRules }: Props) {
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/admin/settings/global-ai-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Applies to ALL shops globally. Injected at the start of every voice call and chat session.</p>
        </div>
        <button
          onClick={() => setRules(DEFAULT_GLOBAL_AI_RULES)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
        >
          <RotateCcw size={12} /> Reset to default
        </button>
      </div>

      <textarea
        value={rules}
        onChange={e => setRules(e.target.value)}
        rows={28}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-600/50 resize-y"
        placeholder="Enter global AI rules..."
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : saved ? <><Check size={14} /> Saved!</> : 'Save Global Rules'}
      </button>
    </div>
  );
}
