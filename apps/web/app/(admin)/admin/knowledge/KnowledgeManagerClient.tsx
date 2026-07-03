'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trash2, Loader2, CheckCircle, XCircle, Globe, Facebook, RotateCcw } from 'lucide-react';

interface Shop {
  id: string;
  name: string;
  category: string;
  knowledge_source: any | null;
  knowledge_chunks: any[];
}

export function KnowledgeManagerClient({ shops }: { shops: Shop[] }) {
  const router                   = useRouter();
  const [search, setSearch]      = useState('');
  const [pending, start]         = useTransition();
  const [actionId, setActionId]  = useState<string | null>(null);
  const [msgs, setMsgs]          = useState<Record<string, string>>({});
  const [rerunUrls, setRerunUrls]= useState<Record<string, { website: string; facebook: string }>>({});

  const filtered = shops.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const getMsg = (shopId: string, text: string) =>
    setMsgs(prev => ({ ...prev, [shopId]: text }));

  const handleReset = (shopId: string, type: 'website' | 'facebook' | 'all') => {
    const label = type === 'all' ? 'ALL knowledge' : `${type} knowledge`;
    if (!confirm(`Reset ${label} for this shop? They will be able to re-run extraction.`)) return;
    setActionId(`${shopId}-reset-${type}`);
    start(async () => {
      const res = await fetch('/api/admin/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, sourceType: type }),
      });
      if (res.ok) {
        getMsg(shopId, `✅ ${label} reset. Client can now re-run extraction.`);
        router.refresh();
      } else {
        getMsg(shopId, `❌ Reset failed`);
      }
      setActionId(null);
    });
  };

  const handleRerun = (shopId: string, type: 'website' | 'facebook') => {
    const urls = rerunUrls[shopId] ?? {};
    const url = type === 'website' ? urls.website : urls.facebook;
    if (!url) { getMsg(shopId, `Please enter a ${type} URL first`); return; }

    setActionId(`${shopId}-${type}`);
    start(async () => {
      const endpoint = type === 'website' ? '/api/training/extract-website' : '/api/training/extract-facebook';
      const body = type === 'website'
        ? { shopId, websiteUrl: url, adminOverride: true }
        : { shopId, facebookUrl: url, adminOverride: true };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        getMsg(shopId, `✅ ${type === 'website' ? 'Website' : 'Facebook'} knowledge re-extracted successfully`);
        router.refresh();
      } else {
        getMsg(shopId, `❌ ${data.error ?? 'Failed'}`);
      }
      setActionId(null);
    });
  };

  const handleDelete = (shopId: string) => {
    if (!confirm('Delete ALL knowledge chunks for this shop? They can re-run extraction after.')) return;
    setActionId(`${shopId}-delete`);
    start(async () => {
      const res = await fetch('/api/admin/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });
      if (res.ok) {
        getMsg(shopId, '✅ Knowledge deleted. Shop can re-run extraction.');
        router.refresh();
      } else {
        getMsg(shopId, '❌ Failed to delete');
      }
      setActionId(null);
    });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shops…"
          className="w-full pl-9 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <p className="text-2xl font-bold text-white">{shops.length}</p>
          <p className="text-xs text-gray-400">Total shops</p>
        </div>
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <p className="text-2xl font-bold text-emerald-400">
            {shops.filter(s => s.knowledge_source?.website_status === 'completed').length}
          </p>
          <p className="text-xs text-gray-400">Website extracted</p>
        </div>
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <p className="text-2xl font-bold text-blue-400">
            {shops.filter(s => s.knowledge_source?.facebook_status === 'completed').length}
          </p>
          <p className="text-xs text-gray-400">Facebook imported</p>
        </div>
      </div>

      {/* Shop list */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {filtered.length} shops
          </p>
        </div>
        <div className="divide-y divide-gray-700">
          {filtered.map(shop => {
            const src  = shop.knowledge_source;
            const wDone = src?.website_status === 'completed';
            const fDone = src?.facebook_status === 'completed';
            const chunks = shop.knowledge_chunks.length;
            const isAct = actionId?.startsWith(shop.id);
            const urls  = rerunUrls[shop.id] ?? { website: src?.website_url ?? '', facebook: src?.facebook_url ?? '' };

            return (
              <div key={shop.id} className="px-5 py-4 space-y-3">
                {/* Shop header */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{shop.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">{shop.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`flex items-center gap-1 text-[11px] ${wDone ? 'text-emerald-400' : 'text-gray-600'}`}>
                        {wDone ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        Website
                      </span>
                      <span className={`flex items-center gap-1 text-[11px] ${fDone ? 'text-blue-400' : 'text-gray-600'}`}>
                        {fDone ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        Facebook
                      </span>
                      {chunks > 0 && (
                        <span className="text-[11px] text-gray-500">{chunks} chunk{chunks > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReset(shop.id, 'all')}
                      disabled={isAct || !src}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-colors disabled:opacity-30"
                      title="Reset — lets client re-run extraction"
                    >
                      {actionId === `${shop.id}-reset-all`
                        ? <Loader2 size={11} className="animate-spin" />
                        : <RotateCcw size={11} />}
                      Reset
                    </button>
                    <button
                      onClick={() => handleDelete(shop.id)}
                      disabled={isAct || chunks === 0}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
                      title="Delete all knowledge chunks"
                    >
                      {actionId === `${shop.id}-delete`
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Re-run controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Website re-run */}
                  <div className="flex gap-2">
                    <input
                      value={urls.website}
                      onChange={e => setRerunUrls(prev => ({ ...prev, [shop.id]: { ...urls, website: e.target.value } }))}
                      placeholder="https://website.com"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      onClick={() => handleReset(shop.id, 'website')}
                      disabled={isAct || !wDone}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-xs transition-colors disabled:opacity-30 shrink-0"
                      title="Reset website — client can re-run"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      onClick={() => handleRerun(shop.id, 'website')}
                      disabled={isAct}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                      {actionId === `${shop.id}-website`
                        ? <Loader2 size={11} className="animate-spin" />
                        : <><Globe size={11} /> Re-extract</>}
                    </button>
                  </div>
                  {/* Facebook re-run */}
                  <div className="flex gap-2">
                    <input
                      value={urls.facebook}
                      onChange={e => setRerunUrls(prev => ({ ...prev, [shop.id]: { ...urls, facebook: e.target.value } }))}
                      placeholder="https://facebook.com/page"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      onClick={() => handleReset(shop.id, 'facebook')}
                      disabled={isAct || !fDone}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-xs transition-colors disabled:opacity-30 shrink-0"
                      title="Reset Facebook — client can re-run"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      onClick={() => handleRerun(shop.id, 'facebook')}
                      disabled={isAct}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                      {actionId === `${shop.id}-facebook`
                        ? <Loader2 size={11} className="animate-spin" />
                        : <><Facebook size={11} /> Re-extract</>}
                    </button>
                  </div>
                </div>

                {msgs[shop.id] && (
                  <p className="text-xs text-gray-400">{msgs[shop.id]}</p>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">No shops found</div>
          )}
        </div>
      </div>
    </div>
  );
}
