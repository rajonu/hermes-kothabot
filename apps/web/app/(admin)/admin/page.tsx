import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Users, DollarSign, Mic, Code2, CreditCard, ShieldCheck } from 'lucide-react';
import { SystemHealthPanel } from './SystemHealthPanel';

async function getDashboardStats() {
  const db = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const [
    shopsResult,
    revenueResult,
    voiceTodayResult,
    apiTodayResult,
    activeSubsResult,
    pendingPayResult,
    shopsData,
  ] = await Promise.all([
    (db as any).from('shops').select('id', { count: 'exact', head: true }),
    (db as any).from('payments').select('amount').eq('status', 'approved'),
    (db as any).from('voice_sessions').select('duration_s').gte('created_at', todayISO),
    (db as any).from('api_usage_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    (db as any).from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    (db as any).from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    (db as any).from('shops').select('id, ai_config').order('created_at', { ascending: false }),
  ]);

  const totalRevenue = (revenueResult.data ?? []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const voiceToday = voiceTodayResult.data ?? [];
  const voiceMinutesToday = Math.round(voiceToday.reduce((s: number, v: any) => s + (v.duration_s || 0), 0) / 6) / 10;
  const voiceCallsToday = voiceToday.length;

  const shops = shopsData.data ?? [];
  const regionStats = shops.reduce(
    (acc: { bd: number; global: number; unknown: number }, s: any) => {
      const r = s.ai_config?.billing_region;
      if (r === 'BD') acc.bd++;
      else if (r === 'INTL') acc.global++;
      else acc.unknown++;
      return acc;
    },
    { bd: 0, global: 0, unknown: 0 }
  );

  return {
    totalClients: shopsResult.count ?? 0,
    totalRevenue,
    voiceMinutesToday,
    voiceCallsToday,
    apiRequestsToday: apiTodayResult.count ?? 0,
    activeSubscriptions: activeSubsResult.count ?? 0,
    pendingPayments: pendingPayResult.count ?? 0,
    regionStats,
  };
}

export default async function AdminPage() {
  const stats = await getDashboardStats();

  const widgets = [
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: '#10b981', href: '/admin/clients' },
    { label: 'Revenue', value: `৳${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: '#06b6d4' },
    { label: 'Voice Today', value: `${stats.voiceMinutesToday}m`, sub: `${stats.voiceCallsToday} calls`, icon: Mic, color: '#f59e0b' },
    { label: 'API Requests Today', value: stats.apiRequestsToday, icon: Code2, color: '#8b5cf6' },
    { label: 'Active Subscriptions', value: stats.activeSubscriptions, icon: ShieldCheck, color: '#10b981' },
    { label: 'Pending Payments', value: stats.pendingPayments, icon: CreditCard, color: stats.pendingPayments > 0 ? '#ef4444' : '#6b7280', href: '/admin/payments', urgent: stats.pendingPayments > 0 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-8">

      {/* ── 6 Stat Widgets ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {widgets.map(({ label, value, sub, icon: Icon, color, href, urgent }: any) => {
          const card = (
            <div className={`rounded-xl border bg-gray-900 p-4 sm:p-5 transition-colors ${
              urgent ? 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10' : 'border-gray-800 hover:border-gray-700'
            }`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
                  <Icon size={14} style={{ color }} />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${urgent ? 'text-red-400' : 'text-white'}`}>{value}</p>
              {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
              {urgent && <p className="text-[10px] text-red-400 mt-1 font-semibold">Needs review →</p>}
            </div>
          );
          return href ? (
            <Link key={label} href={href}>{card}</Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      {/* ── Regional Split ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Clients by Region</h2>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Source: registration / admin override</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 p-3">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold mb-1">🇧🇩 Bangladesh</div>
            <p className="text-2xl font-bold text-white">{stats.regionStats.bd}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">BDT · bKash / Paddle</p>
          </div>
          <div className="rounded-lg border border-cyan-600/20 bg-cyan-600/5 p-3">
            <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold mb-1">🌍 Global</div>
            <p className="text-2xl font-bold text-white">{stats.regionStats.global}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">USD · Paddle</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold mb-1">— Unassigned</div>
            <p className="text-2xl font-bold text-white">{stats.regionStats.unknown}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Set via /admin/shops/[id]</p>
          </div>
        </div>
      </div>

      {/* ── System Health ──────────────────────────────────────── */}
      <SystemHealthPanel />
    </div>
  );
}
