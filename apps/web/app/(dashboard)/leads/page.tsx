export const dynamic = 'force-dynamic';

import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDate } from "@/lib/utils";

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  widget_voice: { label: 'Widget · Voice', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  widget_chat:  { label: 'Widget · Chat',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  phone_sip:    { label: 'IP Phone',        color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  widget:       { label: 'Widget',          color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter = 'all' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await db.from("shops").select("id").eq("owner_id", user.id).single();
  if (!shop) return null;

  let query = db.from("leads")
    .select("id, phone, country, name, source, has_ordered, has_booked, created_at, updated_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) query = query.ilike("phone", `%${q}%`);
  if (filter === 'converted') query = query.or('has_ordered.eq.true,has_booked.eq.true');
  if (filter === 'pending')   query = query.eq('has_ordered', false).eq('has_booked', false);

  const { data: leads } = await query;
  const list = leads || [];

  const totalCount     = list.length;
  const convertedCount = list.filter((l: any) => l.has_ordered || l.has_booked).length;

  return (
    <div>
      <PageHeader title="Leads" description="Every phone number captured by the widget — before they even start a call or chat." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-gray-800 bg-gray-800 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Leads</p>
          <p className="text-2xl font-bold text-white mt-0.5">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-800 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Converted</p>
          <p className="text-2xl font-bold text-emerald-400 mt-0.5">{convertedCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <form method="GET" className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search phone..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50"
          />
        </form>
        <div className="flex gap-2 shrink-0">
          {[['all', 'All'], ['converted', 'Converted'], ['pending', 'Pending']].map(([val, label]) => (
            <a key={val} href={`/leads?filter=${val}${q ? `&q=${q}` : ''}`}
              className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                filter === val
                  ? "bg-emerald-600/10 border-emerald-600/40 text-emerald-500"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
              }`}>
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No leads yet"
            description="Leads are captured automatically when someone enters their phone in your widget."
          />
        ) : (
          <div className="divide-y divide-gray-700">
            {list.map((lead: any) => {
              const src = SOURCE_LABEL[lead.source] ?? SOURCE_LABEL.widget;
              const converted = lead.has_ordered || lead.has_booked;
              return (
                <div key={lead.id} className="p-4 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <a href={`tel:${lead.phone}`} className="text-white font-semibold text-base font-mono hover:text-emerald-400 transition-colors">
                          {lead.phone}
                        </a>
                        {lead.country && lead.country !== 'BD' && (
                          <span className="text-[10px] text-gray-500 uppercase font-bold">{lead.country}</span>
                        )}
                      </div>
                      {lead.name && (
                        <p className="text-sm text-gray-300 mb-1">{lead.name}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${src.color}`}>
                          {src.label}
                        </span>
                        {converted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            {lead.has_booked ? '✓ Booked' : '✓ Ordered'}
                          </span>
                        )}
                        {!converted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border-amber-500/30">
                            ⏳ Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-500">{formatDate(lead.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
