'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface ModelOption {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  description: string;
}

interface Props {
  shopId: string;
  currentModel: string;
  models: readonly ModelOption[];
  onSave: (shopId: string, model: string) => Promise<any>;
}

export function ShopModelSelector({ shopId, currentModel, models, onSave }: Props) {
  const [selected, setSelected] = useState(currentModel);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSelect = (modelId: string) => {
    setSelected(modelId);
    setSaved(false);
  };

  const handleSave = () => {
    startSave(async () => {
      await onSave(shopId, selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Model cards */}
      <div className="grid grid-cols-1 gap-3">
        {models.map(model => {
          const isSelected = selected === model.id;
          return (
            <button
              key={model.id}
              onClick={() => handleSelect(model.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-600/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{model.label}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${model.badgeColor}20`, color: model.badgeColor, border: `1px solid ${model.badgeColor}40` }}
                    >
                      {model.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                  <code className="text-[10px] text-gray-600 font-mono mt-1 block">{model.id}</code>
                </div>
                {/* Radio indicator */}
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || selected === currentModel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check size={14} /> Saved!</>
          ) : (
            'Save Model'
          )}
        </button>
        {selected !== currentModel && !saving && (
          <p className="text-xs text-amber-400">⚠ Unsaved change — new calls will use the selected model after saving.</p>
        )}
        {saved && (
          <p className="text-xs text-emerald-400">✓ Model updated. New voice sessions will use {selected.split('/')[1]}.</p>
        )}
      </div>
    </div>
  );
}
