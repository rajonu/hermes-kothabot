export const dynamic = 'force-dynamic';

// v2
import { Mic, ShoppingBag, Users, TrendingUp, PhoneCall, Calendar, Clock } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/common/StatsCard";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryNav, getDocsCategory } from "@/lib/category-nav";
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar";
import type { Shop } from "@/lib/supabase/types";

async function getDashboardData(shopId: string) {
  const supabase = await createClient();
  const db = supabase as any;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [callsToday, ordersWeek, totalCustomers, recentOrders, recentSessions, weekAppointments] =
    await Promise.all([
      db.from("voice_sessions").select("id", { count: "exact", head: true })
        .eq("shop_id", shopId).gte("created_at", today.toISOString()),
      db.from("orders").select("id", { count: "exact", head: true })
        .eq("shop_id", shopId).gte("created_at", weekAgo.toISOString()),
      db.from("customers").select("id", { count: "exact", head: true })
        .eq("shop_id", shopId),
      db.from("orders").select("id, type, status, total_amount, created_at, customers(name)")
        .eq("shop_id", shopId).order("created_at", { ascending: false }).limit(5),
      db.from("voice_sessions").select("id, status, duration_s, created_at")
        .eq("shop_id", shopId).order("created_at", { ascending: false }).limit(5),
      db.from("orders").select("id, status, items, notes, created_at, customers(name, phone)")
        .eq("shop_id", shopId).eq("type", "appointment")
        .neq("status", "cancelled").order("created_at", { ascending: false }).limit(50),
    ]);

  const revenueResult = await db.from("orders")
    .select("total_amount")
    .eq("shop_id", shopId)
    .eq("status", "completed")
    .gte("created_at", monthStart.toISOString());

  const revenue = (revenueResult.data || []).reduce(
    (sum: number, o: any) => sum + (o.total_amount || 0), 0
  );

  const sessions = recentSessions.data || [];
  const avgSessionSec = sessions.length > 0
    ? Math.round(sessions.filter((s: any) => s.duration_s > 0).reduce((a: number, s: any) => a + s.duration_s, 0) / Math.max(sessions.filter((s: any) => s.duration_s > 0).length, 1))
    : 0;

  return {
    callsToday: callsToday.count ?? 0,
    ordersWeek: ordersWeek.count ?? 0,
    totalCustomers: totalCustomers.count ?? 0,
    revenue,
    avgSessionSec,
    recentOrders: recentOrders.data || [],
    recentSessions: sessions,
    weekAppointments: weekAppointments.data || [],
  };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-500 bg-amber-500/10",
  confirmed: "text-cyan-500 bg-cyan-500/10",
  processing: "text-emerald-500 bg-emerald-500/10",
  completed: "text-emerald-500 bg-emerald-500/10",
  cancelled: "text-red-500 bg-red-500/10",
  active: "text-emerald-500 bg-emerald-500/10",
  ended: "text-gray-400 bg-gray-400/10",
  failed: "text-red-500 bg-red-500/10",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect('/login'); }
  const { data: shopRaw } = await (supabase as any).from("shops").select("*").eq("owner_id", user.id).single();
  const shop = shopRaw as Shop | null;

  if (!shop) return null;

  const catNav = getCategoryNav((shop as any).category);
  const data   = await getDashboardData(shop.id);
  const isBookingCat = catNav.ordersLabel === 'Appointments' || catNav.ordersLabel === 'Bookings';
  const OrdersIcon = isBookingCat ? Calendar : ShoppingBag;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back! Here's what's happening with ${shop.name}.`}
        docsUrl={`https://kothabot.ai.bd/docs/dashboard?category=${getDocsCategory(shop.category)}`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatsCard title="Calls Today"                           value={data.callsToday}              icon={Mic}         iconColor="#10b981" />
        <StatsCard title={`${catNav.ordersStat} This Week`}     value={data.ordersWeek}              icon={OrdersIcon}  iconColor="#06b6d4" />
        <StatsCard title={`Total ${catNav.customersLabel}`}     value={data.totalCustomers}          icon={Users}       iconColor="#f59e0b" />
        <StatsCard title="Avg Call Duration"
          value={data.avgSessionSec > 0 ? `${Math.floor(data.avgSessionSec/60)}m ${data.avgSessionSec%60}s` : '—'}
          icon={Clock} iconColor="#a855f7" />
      </div>

      {/* Weekly Calendar — booking categories only */}
      {isBookingCat && (
        <div className="mb-5">
          <WeeklyCalendar appointments={data.weekAppointments} customersLabel={catNav.customersLabel} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders / Appointments / Bookings */}
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent {catNav.ordersLabel}</h2>
            <a href="/orders" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">View all →</a>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="py-10 text-center">
              <OrdersIcon size={24} className="mx-auto mb-2 text-gray-700" />
              <p className="text-xs text-gray-400">No {catNav.ordersLabel.toLowerCase()} yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((order: any) => (
                <a key={order.id} href={`/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors active:bg-gray-600">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">
                      {order.customers?.name ?? catNav.orderSingular}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize inline-block ${STATUS_COLORS[order.status] || "text-gray-400 bg-gray-600/50"}`}>
                      {order.status}
                    </span>
                    {order.total_amount && (
                      <p className="text-xs text-gray-400 mt-1">{formatCurrency(order.total_amount)}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Recent Calls */}
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Calls</h2>
            <a href="/analytics" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">View analytics →</a>
          </div>
          {data.recentSessions.length === 0 ? (
            <div className="py-10 text-center">
              <PhoneCall size={24} className="mx-auto mb-2 text-gray-700" />
              <p className="text-xs text-gray-400">No calls yet — share your widget to start</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentSessions.map((session: any) => (
                <Link
                  key={session.id}
                  href={`/transcripts?session=${session.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">Voice call</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(session.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize inline-block ${STATUS_COLORS[session.status] || "text-gray-400 bg-gray-600/50"}`}>
                      {session.status}
                    </span>
                    {session.duration_s && (
                      <p className="text-xs text-gray-400 mt-1">{Math.floor(session.duration_s/60)}m {session.duration_s%60}s</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
