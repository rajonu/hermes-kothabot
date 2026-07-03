'use client';

import { useState } from 'react';
import { Loader2, Check, RotateCcw } from 'lucide-react';
import { DEFAULT_CATEGORY_PROMPTS, CATEGORY_LABELS, ALL_CATEGORIES } from '@/lib/prompt-layers';

interface Props {
  initialPrompts: Record<string, string>;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function CategoryPromptsForm({ initialPrompts }: Props) {
  const [prompts, setPrompts] = useState<Record<string, string>>(initialPrompts);
  const [activeTab, setActiveTab] = useState(ALL_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (cat: string, val: string) =>
    setPrompts(prev => ({ ...prev, [cat]: val }));

  const reset = (cat: string) =>
    setPrompts(prev => ({ ...prev, [cat]: DEFAULT_CATEGORY_PROMPTS[cat] ?? '' }));

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/admin/settings/category-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const wc = wordCount(prompts[activeTab] ?? '');
  const isOver = wc > 200;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Each category prompt is injected as <strong className="text-gray-300">Layer 3</strong> of the AI instruction stack — loaded only for matching businesses. Keep each under 200 words for best voice performance.
      </p>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={activeTab === cat
              ? { background: '#10b981', color: '#fff' }
              : { background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Active textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white">{CATEGORY_LABELS[activeTab]}</p>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${isOver ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
              {wc} / 200 words{isOver ? ' ⚠ too long' : ''}
            </span>
            <button
              onClick={() => reset(activeTab)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>

        <textarea
          value={prompts[activeTab] ?? ''}
          onChange={e => update(activeTab, e.target.value)}
          rows={12}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-600/50 resize-y"
          style={isOver ? { borderColor: '#f87171' } : {}}
          placeholder={`Category rules for ${CATEGORY_LABELS[activeTab]}…`}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
         : saved  ? <><Check size={14} /> Saved!</>
         : 'Save All Category Prompts'}
      </button>
    </div>
  );
}
