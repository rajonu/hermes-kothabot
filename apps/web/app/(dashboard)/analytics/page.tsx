export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { getDocsCategory } from "@/lib/category-nav";
import { Phone, Clock, TrendingUp, CheckCircle, ShoppingBag, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d;
}
function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function hourLabel(h: number) {
  if (h === 0) return '12am'; if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h-12}pm`;
}

async function getAnalytics(shopId: string) {
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const day = daysAgo(0);
  const week = daysAgo(7);
  const month = daysAgo(30);
  const prevWeek = daysAgo(14);

  const [sessions, orders, sessionsThisWeek, sessionsPrevWeek] = await Promise.all([
    db.from('voice_sessions').select('id, status, duration_s, created_at, end_reason, off_topic_count')
      .eq('shop_id', shopId).gte('created_at', month.toISOString()).order('created_at', { ascending: false }),
    db.from('orders').select('id, type, status, total_amount, created_at')
      .eq('shop_id', shopId).gte('created_at', month.toISOString()),
    db.from('voice_sessions').select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId).gte('created_at', week.toISOString()),
    db.from('voice_sessions').select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId).gte('created_at', prevWeek.toISOString()).lt('created_at', week.toISOString()),
  ]);

  const allSessions: any[] = sessions.data || [];
  const allOrders: any[] = orders.data || [];

  // ── Stats ──
  const totalCalls = allSessions.length;
  const completedCalls = allSessions.filter(s => s.status === 'completed' || s.status === 'ended').length;
  const completionRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;
  const avgDuration = totalCalls > 0
    ? Math.round(allSessions.filter(s => s.duration_s).reduce((a, s) => a + s.duration_s, 0) / totalCalls)
    : 0;
  const revenue = allOrders.filter(o => o.status === 'completed')
    .reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
  const thisWeekCalls = sessionsThisWeek.count ?? 0;
  const prevWeekCalls = sessionsPrevWeek.count ?? 0;
  const weekGrowth = prevWeekCalls > 0 ? Math.round(((thisWeekCalls - prevWeekCalls) / prevWeekCalls) * 100) : null;

  // ── Calls per day (last 7 days) ──
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  });
  const callsByDay: Record<string, number> = {};
  last7.forEach(d => { callsByDay[d] = 0; });
  allSessions.forEach(s => {
    const day = s.created_at?.slice(0,10);
    if (day && callsByDay[day] !== undefined) callsByDay[day]++;
  });
  const dailyMax = Math.max(...Object.values(callsByDay), 1);

  // ── Calls by hour (0-23) ──
  const callsByHour: Record<number, number> = {};
  for (let h = 0; h < 24; h++) callsByHour[h] = 0;
  allSessions.forEach(s => {
    const h = new Date(s.created_at).getHours();
    callsByHour[h]++;
  });
  const hourMax = Math.max(...Object.values(callsByHour), 1);

  // ── Session end reasons breakdown ──
  const endReasons: Record<string, number> = {};
  let totalOffTopic = 0;
  allSessions.forEach((s: any) => {
    const reason = s.end_reason ?? 'completed';
    endReasons[reason] = (endReasons[reason] ?? 0) + 1;
    totalOffTopic += s.off_topic_count ?? 0;
  });

  return { totalCalls, completedCalls, completionRate, avgDuration, revenue,
    thisWeekCalls, weekGrowth, last7, callsByDay, dailyMax,
    callsByHour, hourMax, recentSessions: allSessions.slice(0, 10),
    totalOrders: allOrders.length, endReasons, totalOffTopic };
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await (supabase as any).from('shops').select('id, category').eq('owner_id', user.id).single();
  if (!shopRaw) return null;

  const a = await getAnalytics(shopRaw.id);
  const isEmpty = a.totalCalls === 0;

  return (
    <div>
      <PageHeader title="Analytics" description="Call volume, peak hours, and performance over the last 30 days." docsUrl={`https://kothabot.ai.bd/docs/analytics?category=${getDocsCategory(shopRaw.category)}`} />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Calls', value: a.totalCalls, icon: Phone, color: '#10b981',
            sub: a.weekGrowth !== null ? `${a.weekGrowth >= 0 ? '▲' : '▼'} ${Math.abs(a.weekGrowth)}% vs last week` : 'No data yet',
            subPositive: (a.weekGrowth ?? 0) >= 0 },
          { label: 'Avg Duration', value: a.avgDuration ? `${Math.floor(a.avgDuration/60)}m ${a.avgDuration%60}s` : '—', icon: Clock, color: '#06b6d4', sub: 'Per call (last 30 days)' },
          { label: 'Completion Rate', value: `${a.completionRate}%`, icon: CheckCircle, color: '#f59e0b',
            sub: `${a.completedCalls} of ${a.totalCalls} calls` },
          { label: 'Revenue (30d)', value: formatCurrency(a.revenue), icon: TrendingUp, color: '#ef4444',
            sub: `${a.totalOrders} orders` },
        ].map(({ label, value, icon: Icon, color, sub, subPositive }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-800 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{value}</p>
            <p className={`text-xs ${subPositive === false ? 'text-red-400' : 'text-gray-500'}`}>{sub}</p>
          </div>
        ))}
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-16 text-center">
          <Phone size={32} className="mx-auto mb-3 text-gray-700" />
          <p className="text-white font-semibold">No calls yet</p>
          <p className="text-sm text-gray-400 mt-1">Share your widget to start getting voice calls. Analytics will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Calls per day bar chart */}
          <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
            <h2 className="text-sm font-semibold text-white mb-5">Calls — Last 7 Days</h2>
            <div className="flex items-end gap-2 h-32">
              {a.last7.map(day => {
                const count = a.callsByDay[day] ?? 0;
                const pct = Math.round((count / a.dailyMax) * 100);
                const isToday = day === new Date().toISOString().slice(0,10);
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{count > 0 ? count : ''}</span>
                    <div className="w-full rounded-t-lg transition-all" style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: isToday ? '#10b981' : count > 0 ? '#10b98150' : '#374151',
                      minHeight: 4,
                    }} />
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(day).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peak hours */}
          <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Peak Hours</h2>
            <div className="space-y-1.5">
              {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1].map(h => {
                const count = a.callsByHour[h] ?? 0;
                const pct = Math.round((count / a.hourMax) * 100);
                return (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 w-10 text-right shrink-0">{hourLabel(h)}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(pct, 0)}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400 w-6 text-right shrink-0">{count || ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Protection Stats */}
          {(a.endReasons['off_topic_limit'] || a.endReasons['time_limit'] || a.endReasons['silence_timeout'] || a.totalOffTopic > 0) && (
            <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={16} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-white">AI Cost Protection</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Completed', value: a.endReasons['completed'] ?? 0, color: 'text-emerald-500' },
                  { label: 'Time Limit', value: a.endReasons['time_limit'] ?? 0, color: 'text-amber-500' },
                  { label: 'Off-Topic Ended', value: a.endReasons['off_topic_limit'] ?? 0, color: 'text-red-500' },
                  { label: 'Silence Timeout', value: a.endReasons['silence_timeout'] ?? 0, color: 'text-gray-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-3 rounded-lg bg-gray-900">
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
              {a.totalOffTopic > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  {a.totalOffTopic} off-topic attempt{a.totalOffTopic !== 1 ? 's' : ''} blocked across all sessions (30 days)
                </p>
              )}
            </div>
          )}

          {/* Recent calls */}
          <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-white">Recent Calls</h2>
            </div>
            <div className="divide-y divide-gray-700">
              {a.recentSessions.map((s: any) => {
                const endReason = s.end_reason ?? 'completed';
                const reasonColors: Record<string, string> = {
                  completed:          'text-emerald-500 bg-emerald-500/10',
                  user_requested_end: 'text-emerald-500 bg-emerald-500/10',
                  off_topic_limit:    'text-red-500 bg-red-500/10',
                  time_limit:         'text-amber-500 bg-amber-500/10',
                  silence_timeout:    'text-gray-400 bg-gray-700',
                  system_end:         'text-gray-400 bg-gray-700',
                  ws_disconnected:    'text-gray-400 bg-gray-700',
                };
                const reasonLabels: Record<string, string> = {
                  completed: 'Completed', user_requested_end: 'User Ended',
                  off_topic_limit: 'Off-Topic', time_limit: 'Time Limit',
                  silence_timeout: 'Silence', system_end: 'System', ws_disconnected: 'Dropped',
                };
                const clr = reasonColors[endReason] ?? 'text-gray-400 bg-gray-700';
                const date = new Date(s.created_at);
                return (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-xs text-white font-medium">
                        {date.toLocaleDateString('en', { day: 'numeric', month: 'short' })} at {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{s.id.slice(0,8)}…</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.duration_s && <span className="text-xs text-gray-400">{s.duration_s}s</span>}
                      {(s.off_topic_count ?? 0) > 0 && (
                        <span className="text-[10px] text-red-400">{s.off_topic_count} off-topic</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${clr}`}>
                        {reasonLabels[endReason] ?? endReason}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
