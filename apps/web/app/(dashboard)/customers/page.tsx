export const dynamic = 'force-dynamic';

import { Users } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryNav, getDocsCategory } from "@/lib/category-nav";
import type { Shop } from "@/lib/supabase/types";
import { NewCustomerButton } from "./NewCustomerButton";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort = "created_at" } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await db.from("shops").select("id, category").eq("owner_id", user.id).single();
  const shop = shopRaw as (Pick<Shop, "id"> & { category: string }) | null;
  if (!shop) return null;
  const catNav = getCategoryNav(shop.category);
  const ordersHeader = catNav.ordersStat; // "Appointments" / "Bookings" / "Orders" / etc.
  const ordersLower  = ordersHeader.toLowerCase();

  let query = db.from("customers")
    .select("id, name, phone, lifetime_value, order_count, created_at")
    .eq("shop_id", shop.id)
    .order(sort === "value" ? "lifetime_value" : "created_at", { ascending: false })
    .limit(50);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: customers } = await query;
  const list = customers || [];

  return (
    <div>
      <PageHeader title={catNav.customersLabel} description="Profiles built automatically from voice interactions." docsUrl={`https://kothabot.ai.bd/docs/customers-module?category=${getDocsCategory(shop.category)}`} action={<NewCustomerButton catNav={catNav} />} />

      {/* Search row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <form method="GET" className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            placeholder={`Search ${catNav.customersLabel.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-600/20 transition-colors"
          />
        </form>
        <div className="flex gap-2 shrink-0">
          {[["created_at", "Newest"], ["value", "Top Value"]].map(([val, label]) => (
            <a key={val} href={`/customers?sort=${val}${q ? `&q=${q}` : ""}`}
              className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                sort === val
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
            icon={Users}
            title={`No ${catNav.customersLabel.toLowerCase()} yet`}
            description={`${catNav.customersLabel} profiles are created automatically when someone calls your AI assistant.`}
          />
        ) : (
          /* Mobile: card list. Desktop: table */
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-700">
              {list.map((customer: any) => (
                <Link key={customer.id} href={`/customers/${customer.id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-gray-700 transition-colors active:bg-gray-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{customer.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{customer.phone ?? "No phone"} · {customer.order_count} {ordersLower}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-emerald-500">{formatCurrency(customer.lifetime_value)}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(customer.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900">
                    {["Name", "Phone", ordersHeader, "Lifetime Value", "Since"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((customer: any, i: number) => (
                    <tr key={customer.id}
                      className={`hover:bg-gray-700 transition-colors ${i < list.length - 1 ? "border-b border-gray-700" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/customers/${customer.id}`} className="text-sm font-medium text-white hover:text-emerald-500 transition-colors">
                          {customer.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{customer.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-white">{customer.order_count}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-500">{formatCurrency(customer.lifetime_value)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(customer.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
