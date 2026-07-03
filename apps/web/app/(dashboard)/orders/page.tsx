export const dynamic = 'force-dynamic';

import { ShoppingBag, Calendar } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { AutoRefresh } from "@/components/AutoRefresh";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryNav, getDocsCategory } from "@/lib/category-nav";
import type { Shop } from "@/lib/supabase/types";
import { NewOrderButton } from "./NewOrderButton";
import { ExportButton } from "./ExportButton";
import { ImportButton } from "./ImportButton";

// Format created_at as "25 Jun 2026, 2:30 PM"
function formatDateTime(s: string): string {
  return `${formatDate(s)}, ${new Date(s).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

// Format ISO-ish datetime to "26 May 10:00 AM" without locale fuss
function formatWhen(s?: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Build a category-aware one-line summary for the order row
function getRowSummary(category: string, order: any): string {
  const m = order.metadata ?? {};
  const item0 = order.items?.[0] ?? {};
  if (category === 'clinic') {
    const doctor = m.doctor_name ?? item0.doctor_name;
    const when = m.appointment_at ?? item0.appointment_at;
    const parts = [doctor, formatWhen(when)].filter(Boolean);
    return parts.join(' · ');
  }
  if (category === 'salon' || category === 'services') {
    const service = m.service_name ?? item0.service_name;
    const when = m.booking_at ?? item0.appointment_at;
    const parts = [service, formatWhen(when)].filter(Boolean);
    return parts.join(' · ');
  }
  if (category === 'real_estate') {
    const parts = [m.property_name, m.property_type, m.location].filter(Boolean);
    return parts.join(' · ');
  }
  if (category === 'education') {
    const parts = [m.course_name, m.batch].filter(Boolean);
    return parts.join(' · ');
  }
  if (category === 'creative_agency') {
    const parts = [m.service_type, m.project_brief ? m.project_brief.slice(0, 40) : null].filter(Boolean);
    return parts.join(' · ');
  }
  return getItemSummary(order.items);
}

// Extract a field value from the notes string: "Name: John | Phone: 01700..."
function extractFromNotes(notes: string | null, field: string): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${field}:\\s*([^|]+)`));
  return match?.[1]?.trim() ?? null;
}

// Build readable item list from items JSONB
function getItemSummary(items: any[]): string {
  if (!items?.length) return '';
  return items.map((it: any) => {
    const qty  = it.quantity > 1 ? `${it.quantity}× ` : '';
    const name = it.name ?? 'Item';
    return `${qty}${name}`;
  }).join(', ');
}

const STATUS_STYLES: Record<string, string> = {
  pending:    "text-amber-500 bg-amber-500/10 border-amber-500/20",
  confirmed:  "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  processing: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  completed:  "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  cancelled:  "text-red-500 bg-red-500/10 border-red-500/20",
};

const STATUSES = ["pending", "confirmed", "processing", "completed", "cancelled"];
const TYPES    = ["order", "appointment", "lead"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string; period?: string }>;
}) {
  const { status, type, q, period } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await db.from("shops").select("id, category").eq("owner_id", user.id).single();
  const shop = shopRaw as any | null;
  if (!shop) return null;

  const catNav = getCategoryNav(shop.category);

  // Load product list for the New Order modal (lean — name/price only)
  const { data: products } = await db.from("products")
    .select("id, name, price")
    .eq("shop_id", shop.id)
    .eq("is_available", true)
    .order("name");

  let query = db.from("orders")
    .select("id, type, status, total_amount, items, notes, metadata, created_at, customers(name, phone)")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (type)   query = query.eq("type", type);

  if (period) {
    const now = new Date();
    let from: Date;
    if (period === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      from = new Date(now); from.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      from = new Date(now); from.setMonth(now.getMonth() - 1);
    } else {
      from = new Date(0);
    }
    query = query.gte("created_at", from.toISOString());
  }

  const { data: orders } = await query;
  let list = orders || [];
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((o: any) =>
      (o.customers?.name ?? '').toLowerCase().includes(needle) ||
      (o.customers?.phone ?? '').toLowerCase().includes(needle) ||
      (o.notes ?? '').toLowerCase().includes(needle)
    );
  }

  return (
    <div>
      <AutoRefresh interval={5000} />
      <PageHeader
        title={catNav.ordersLabel}
        description={`${catNav.ordersLabel} created by your AI voice assistant.`}
        docsUrl={`https://kothabot.ai.bd/docs/orders-module?category=${getDocsCategory(shop.category)}`}
        action={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <ImportButton shopId={shop.id} />
            <ExportButton orders={list} label={catNav.ordersLabel} />
            <NewOrderButton category={shop.category} products={products ?? []} catNav={catNav} />
          </div>
        }
      />

      {/* Search box */}
      <form method="GET" className="relative mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        {type && <input type="hidden" name="type" value={type} />}
        {period && <input type="hidden" name="period" value={period} />}
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          name="q"
          defaultValue={q}
          placeholder={`Search ${catNav.ordersLabel.toLowerCase()} by name, phone…`}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50"
        />
      </form>

      {/* Period pills */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
        {([['', 'All Time'], ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']] as const).map(([val, label]) => {
          const href = val ? `/orders?period=${val}${status ? `&status=${status}` : ''}${type ? `&type=${type}` : ''}` : `/orders${status ? `?status=${status}` : ''}${type ? `${status ? '&' : '?'}type=${type}` : ''}`;
          return (
            <a key={val} href={href}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                period === val || (!period && val === '')
                  ? "bg-violet-600/10 border-violet-600/30 text-violet-400"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
              }`}>{label}</a>
          );
        })}
      </div>

      {/* Filter pills — horizontally scrollable on mobile */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        <a href={`/orders${period ? `?period=${period}` : ''}`}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
            !status && !type
              ? "bg-emerald-600/10 border-emerald-600/30 text-emerald-500"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
          }`}>All</a>

        {STATUSES.map(s => (
          <a key={s} href={`/orders?status=${s}${period ? `&period=${period}` : ''}`}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors whitespace-nowrap ${
              status === s
                ? "bg-emerald-600/10 border-emerald-600/30 text-emerald-500"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}>{s}</a>
        ))}

        <div className="shrink-0 w-px bg-gray-800" />

        {TYPES.map(t => (
          <a key={t} href={`/orders?type=${t}${period ? `&period=${period}` : ''}`}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors whitespace-nowrap ${
              type === t
                ? "bg-cyan-600/10 border-cyan-600/30 text-cyan-500"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}>{t}</a>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={catNav.ordersLabel === 'Appointments' || catNav.ordersLabel === 'Bookings' ? Calendar : ShoppingBag}
            title={`No ${catNav.ordersLabel.toLowerCase()} yet`}
            description={`When customers ${catNav.ordersLabel === 'Appointments' ? 'book appointments' : catNav.ordersLabel === 'Bookings' ? 'make bookings' : 'place orders'} through your AI assistant, they'll appear here.`}
          />
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden divide-y divide-gray-700">
              {list.map((order: any) => {
                const customerName = order.customers?.name ?? order.metadata?.patient_name ?? extractFromNotes(order.notes, 'Name') ?? '—';
                const itemSummary  = getRowSummary(shop.category, order);
                return (
                  <Link key={order.id} href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-4 py-4 hover:bg-gray-700 transition-colors active:bg-gray-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{customerName}</p>
                      {itemSummary && <p className="text-xs text-gray-400 mt-0.5 truncate">{itemSummary}</p>}
                      <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(order.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-xs font-semibold capitalize px-2 py-1 rounded-full border inline-block ${STATUS_STYLES[order.status] ?? "text-gray-400 bg-gray-700/50 border-gray-600/20"}`}>
                        {order.status}
                      </span>
                      {order.total_amount && (
                        <p className="text-xs text-gray-400 mt-1">{formatCurrency(order.total_amount)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900">
                    {["Customer", "Items", "Status", "Amount", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((order: any, i: number) => {
                    const customerName = order.customers?.name ?? order.metadata?.patient_name ?? extractFromNotes(order.notes, 'Name') ?? '—';
                    const customerPhone = order.customers?.phone ?? extractFromNotes(order.notes, 'Phone');
                    const itemSummary   = getRowSummary(shop.category, order);
                    return (
                      <tr key={order.id}
                        className={`hover:bg-gray-700 transition-colors ${i < list.length - 1 ? "border-b border-gray-700" : ""}`}>
                        <td className="px-4 py-3">
                          <Link href={`/orders/${order.id}`} className="text-sm text-white hover:text-emerald-400 transition-colors font-medium">
                            {customerName}
                          </Link>
                          {customerPhone && <p className="text-xs text-gray-400 mt-0.5">{customerPhone}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300 max-w-[200px]">
                          <p className="truncate">{itemSummary || <span className="text-gray-600">—</span>}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold capitalize px-2 py-1 rounded-full border inline-block ${STATUS_STYLES[order.status] ?? "text-gray-400 bg-gray-700/50 border-gray-600/20"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{order.total_amount ? formatCurrency(order.total_amount) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(order.created_at)}</td>
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
