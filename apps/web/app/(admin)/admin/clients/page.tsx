import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { DEFAULT_MODEL } from '@/lib/admin';
import { Settings } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function AdminClientsPage() {
  const db = createAdminClient();
  const { data: shops, count } = await (db as any)
    .from('shops')
    .select('id, name, category, ai_config, created_at, subscriptions(status)', { count: 'exact' })
    .order('created_at', { ascending: false });

  const allShops = shops ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">All Clients</h1>
          <p className="text-xs text-gray-500 mt-0.5">{count ?? allShops.length} shops registered</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {allShops.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No clients yet.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-800">
              {allShops.map((shop: any) => {
                const model = shop.ai_config?.ai_model ?? DEFAULT_MODEL;
                const modelLabel = model.includes('3.1') ? 'Gemini 3.1' : model.includes('2.5') ? 'Gemini 2.5' : model.includes('2.0') ? 'Gemini 2.0' : 'Gemini';
                const subStatus = shop.subscriptions?.[0]?.status ?? shop.subscriptions?.status;
                const isActive = subStatus === 'active' || subStatus === 'trialing';
                const region = shop.ai_config?.billing_region;
                return (
                  <Link key={shop.id} href={`/admin/shops/${shop.id}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/50 active:bg-gray-800 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{shop.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 capitalize">{shop.category}</span>
                        {region && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            region === 'BD' ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' : 'bg-cyan-600/15 text-cyan-400 border border-cyan-600/20'
                          }`}>{region === 'BD' ? '🇧🇩 BD' : '🌍 Global'}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          isActive ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20'
                          : subStatus === 'past_due' ? 'bg-red-600/15 text-red-400 border border-red-600/20'
                          : subStatus === 'cancelled' ? 'bg-gray-700 text-gray-400 border border-gray-600'
                          : 'bg-amber-600/15 text-amber-400 border border-amber-600/20'
                        }`}>{isActive ? 'Active' : subStatus === 'past_due' ? 'Past Due' : subStatus === 'cancelled' ? 'Cancelled' : 'Trial'}</span>
                      </div>
                    </div>
                    <span className="text-emerald-500 text-xs ml-3 shrink-0">Manage →</span>
                  </Link>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950">
                    {['Shop Name', 'Category', 'Region', 'AI Model', 'Status', 'Joined', 'Manage'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allShops.map((shop: any, i: number) => {
                    const model = shop.ai_config?.ai_model ?? DEFAULT_MODEL;
                    const modelLabel = model.includes('3.1') ? 'Gemini 3.1' : model.includes('2.5') ? 'Gemini 2.5' : model.includes('2.0') ? 'Gemini 2.0' : model;
                    const subStatus = shop.subscriptions?.[0]?.status ?? shop.subscriptions?.status;
                const isActive = subStatus === 'active' || subStatus === 'trialing';
                    const region = shop.ai_config?.billing_region;
                    return (
                      <tr key={shop.id} className={`transition-colors hover:bg-gray-800/50 ${i < allShops.length - 1 ? 'border-b border-gray-800' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-sm text-white">{shop.name}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">{shop.id.slice(0, 8)}…</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 capitalize">{shop.category}</span>
                        </td>
                        <td className="px-5 py-4">
                          {region ? (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              region === 'BD' ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' : 'bg-cyan-600/15 text-cyan-400 border border-cyan-600/20'
                            }`}>{region === 'BD' ? '🇧🇩 BD' : '🌍 Global'}</span>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            model.includes('3.1') ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' :
                            model.includes('2.5') ? 'bg-amber-600/15 text-amber-400 border border-amber-600/20' :
                            'bg-indigo-600/15 text-indigo-400 border border-indigo-600/20'
                          }`}>{modelLabel}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            isActive ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20'
                            : subStatus === 'past_due' ? 'bg-red-600/15 text-red-400 border border-red-600/20'
                            : subStatus === 'cancelled' ? 'bg-gray-700 text-gray-400 border border-gray-600'
                            : 'bg-amber-600/15 text-amber-400 border border-amber-600/20'
                          }`}>{isActive ? 'Active' : subStatus === 'past_due' ? 'Past Due' : subStatus === 'cancelled' ? 'Cancelled' : 'Trial'}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(shop.created_at)}</td>
                        <td className="px-5 py-4">
                          <Link href={`/admin/shops/${shop.id}`} className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-semibold">
                            <Settings size={13} /> Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
