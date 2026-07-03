'use client';

import { useState, useTransition } from 'react';
import { Globe, Loader2, CheckCircle, AlertCircle, Zap, Lock, Eye, EyeOff } from 'lucide-react';

interface KnowledgeChunk {
  id: string;
  source_type: string;
  content: string;
  word_count: number;
  created_at: string;
}

interface KnowledgeSource {
  id?: string;
  website_url?: string;
  facebook_url?: string;
  website_status?: string;   // completed | failed | null
  facebook_status?: string;
  extraction_status?: string;
  extracted_at?: string;
}

interface Props {
  shopId: string;
  initialSource: KnowledgeSource | null;
  initialChunks: KnowledgeChunk[];
}

export function KnowledgeExtractor({ shopId, initialSource, initialChunks }: Props) {
  const [source, setSource]       = useState<KnowledgeSource | null>(initialSource);
  const [chunks, setChunks]       = useState<KnowledgeChunk[]>(initialChunks);
  const [websiteUrl, setWebsite]  = useState(initialSource?.website_url ?? '');
  const [webPending, startWeb]    = useTransition();
  const [webMsg, setWebMsg]       = useState('');
  const [webError, setWebError]   = useState('');
  const [showWebContent, setShowWeb]  = useState(false);

  const websiteDone    = source?.website_status === 'completed';
  const extractedDate  = source?.extracted_at
    ? new Date(source.extracted_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const handleWebsiteExtract = () => {
    if (!websiteUrl.trim()) { setWebError('Please enter a website URL.'); return; }
    setWebError(''); setWebMsg('');
    startWeb(async () => {
      const res = await fetch('/api/training/extract-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, websiteUrl: websiteUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebMsg(`✅ Knowledge extracted successfully! (${data.wordCount} words)`);
        setSource(prev => ({ ...prev, website_url: websiteUrl.trim(), website_status: 'completed', extracted_at: new Date().toISOString() }));
        if (data.preview) {
          setChunks(prev => [...prev.filter(c => c.source_type !== 'website'), { id: 'new-web', source_type: 'website', content: data.fullContent ?? data.preview, word_count: data.wordCount, created_at: new Date().toISOString() }]);
        }
      } else if (data.alreadyExtracted) {
        setWebError('Knowledge already imported. Contact support to refresh.');
        setSource(prev => ({ ...prev, website_status: 'completed' }));
      } else {
        setWebError(data.error ?? 'Extraction failed. Please try again.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Zap size={15} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Website Knowledge Extraction</h2>
          {websiteDone && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 font-medium">
              ✓ Extracted{extractedDate ? ` · ${extractedDate}` : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Provide your website URL and AI will automatically extract business information — services, hours, contacts, policies — and optimize it for fast voice responses.
        </p>
      </div>

      {/* Website */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-2">
          <Globe size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Website</span>
          {websiteDone && <CheckCircle size={13} className="text-emerald-400 ml-auto" />}
        </div>
        <div className="p-5 space-y-3">
          {websiteDone && !webMsg ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-2.5 rounded-lg">
                <CheckCircle size={13} />
                Knowledge imported from {source?.website_url ?? 'your website'}.
                <button onClick={() => setShowWeb(v => !v)} className="ml-auto flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                  {showWebContent ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showWebContent ? 'Hide' : 'View data'}
                </button>
              </div>
              {showWebContent && (() => {
                const chunk = chunks.find(c => c.source_type === 'website');
                return chunk ? (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 mb-2">{chunk.word_count} words extracted</p>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{chunk.content}</pre>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  disabled={websiteDone}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  AI will crawl your website and extract business info, services, contact details, and policies.
                </p>
              </div>
              {webMsg && (
                <p className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-2 rounded-lg">{webMsg}</p>
              )}
              {webError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {webError}
                </div>
              )}
              {!websiteDone && (
                <button
                  onClick={handleWebsiteExtract}
                  disabled={webPending || !websiteUrl.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {webPending
                    ? <><Loader2 size={14} className="animate-spin" /> Extracting… (this may take 20-30 seconds)</>
                    : <><Globe size={14} /> Scrape & Train</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>



      {/* One-time notice */}
      {!websiteDone && (
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-800/50 border border-gray-700 px-3 py-2.5 rounded-lg">
          <Lock size={12} className="mt-0.5 shrink-0" />
          Extraction runs once per source to control costs. After import, contact support to refresh.
        </div>
      )}
    </div>
  );
}
