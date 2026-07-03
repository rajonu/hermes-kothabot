'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, BookOpen, HelpCircle, FileText } from 'lucide-react';

type SourceType = 'faq' | 'manual';

interface Entry {
  id: string;
  source_type: SourceType;
  extracted_text: string;
  source_url?: string;
  created_at: string;
}

interface Props {
  shopId: string;
  shopName: string;
  initialEntries: Entry[];
}

const TYPE_CONFIG: Record<SourceType, { label: string; color: string; icon: any; placeholder: string }> = {
  faq:    { label: 'FAQ',  color: 'text-cyan-400',  icon: HelpCircle, placeholder: 'Q: What are your delivery charges?\nA: We offer free delivery within Dhaka for orders above ৳500.' },
  manual: { label: 'Info', color: 'text-amber-400', icon: FileText,   placeholder: 'Our shop is open Saturday to Thursday, 9am to 9pm. We are closed on Fridays.' },
};

export function TrainingManager({ shopId, initialEntries }: Props) {
  const router                  = useRouter();
  const [entries, setEntries]   = useState<Entry[]>(initialEntries);
  const [tab, setTab]           = useState<SourceType>('faq');
  const [text, setText]         = useState('');
  const [error, setError]       = useState('');
  const [pending, start]        = useTransition();
  const [deletingId, setDel]    = useState<string | null>(null);

  const cfg = TYPE_CONFIG[tab];

  const handleAdd = () => {
    if (!text.trim()) { setError('Please enter content.'); return; }
    setError('');
    start(async () => {
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, source_type: tab, extracted_text: text.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(prev => [data.entry, ...prev]);
        setText('');
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to save');
      }
    });
  };

  const handleDelete = (id: string) => {
    setDel(id);
    start(async () => {
      await fetch(`/api/training?id=${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
      setDel(null);
    });
  };

  const faqCount  = entries.filter(e => e.source_type === 'faq').length;
  const infoCount = entries.filter(e => e.source_type === 'manual').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { type: 'faq'    as SourceType, count: faqCount,  cfg: TYPE_CONFIG.faq },
          { type: 'manual' as SourceType, count: infoCount, cfg: TYPE_CONFIG.manual },
        ].map(({ type, count, cfg }) => {
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => setTab(type)}
              className={`rounded-xl border p-4 text-left transition-all ${
                tab === type ? 'border-emerald-500 bg-emerald-600/10' : 'border-gray-800 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <Icon size={16} className={cfg.color + ' mb-2'} />
              <p className={`text-xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-gray-400">{cfg.label} entries</p>
            </button>
          );
        })}
      </div>

      {/* Add new */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-2">
          <Plus size={15} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Add Knowledge</h2>
          {/* Type tabs */}
          <div className="ml-auto flex gap-1">
            {(['faq', 'manual'] as SourceType[]).map(t => {
              const Ico = TYPE_CONFIG[t].icon;
              return (
                <button
                  key={t}
                  onClick={() => { setTab(t); setText(''); setError(''); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    tab === t
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 bg-gray-700 hover:text-white'
                  }`}
                >
                  <Ico size={12} /> {TYPE_CONFIG[t].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              {tab === 'faq'
                ? <span>FAQ Entry <span className="text-gray-600 font-normal">(use Q: / A: format)</span></span>
                : <span>Business Information <span className="text-gray-600 font-normal">(hours, policies, products, etc.)</span></span>}
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={cfg.placeholder}
              rows={4}
              className={`w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none ${tab === 'faq' ? 'font-mono text-xs' : ''}`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleAdd}
            disabled={pending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
          >
            {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Plus size={14} /> Add Entry</>}
          </button>
        </div>
      </div>

      {/* Entries list */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Knowledge Base</h2>
          <span className="text-xs text-gray-500">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <BookOpen size={28} className="text-gray-700" />
            <div>
              <p className="text-sm font-medium text-white">No entries yet</p>
              <p className="text-xs text-gray-400 mt-1">Add FAQs and business info above to train your assistant.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {entries.map((entry) => {
              const cfg = TYPE_CONFIG[entry.source_type as SourceType] ?? TYPE_CONFIG.manual;
              const Icon = cfg.icon;
              return (
                <div key={entry.id} className="px-5 py-4 flex items-start gap-3 group">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5`}
                    style={{ background: `${cfg.color.replace('text-', '')}15` }}>
                    <Icon size={13} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(entry.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {entry.extracted_text}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                  >
                    {deletingId === entry.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
