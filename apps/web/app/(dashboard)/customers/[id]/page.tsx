import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryNav } from "@/lib/category-nav";
import { EditCustomerForm } from "./EditCustomerForm";

function waLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('880') ? digits : `880${digits.replace(/^0/, '')}`}`;
}

const STATUS_STYLES: Record<string, string> = {
  pending:    "text-[#ffd740] bg-[#ffd740]/10",
  confirmed:  "text-[#00bcd4] bg-[#00bcd4]/10",
  processing: "text-[#00e676] bg-[#00e676]/10",
  completed:  "text-[#00e676] bg-[#00e676]/10",
  cancelled:  "text-[#ff6b6b] bg-[#ff6b6b]/10",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await db.from("shops").select("id, category").eq("owner_id", user.id).single();
  const catNav = getCategoryNav(shopRaw?.category);

  const { data: customer } = await db.from("customers")
    .select("*")
    .eq("id", id)
    .eq("shop_id", shopRaw?.id)
    .single();

  if (!customer) notFound();

  const { data: orders } = await db.from("orders")
    .select("id, type, status, total_amount, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const orderList = orders || [];

  return (
    <div>
      <div className="mb-4">
        <Link href="/customers" className="flex items-center gap-1.5 text-xs text-[#7a9e88] hover:text-[#e8f5e9] transition-colors w-fit">
          <ArrowLeft size={13} /> Back to {catNav.customersLabel}
        </Link>
      </div>

      <PageHeader title={customer.name} description={`${catNav.customersLabel.replace(/s$/, '')} since ${formatDate(customer.created_at)}`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#e8f5e9]">Profile</h2>
            <div>
              <p className="text-xs text-[#7a9e88]">Phone</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-medium text-[#e8f5e9]">{customer.phone ?? "—"}</p>
                {waLink(customer.phone) && (
                  <a href={waLink(customer.phone)!} target="_blank" rel="noopener" className="text-xs text-[#00e676] hover:underline">WhatsApp</a>
                )}
              </div>
            </div>
            {[
              ["Address", customer.address ?? "—"],
              ["Total Orders", customer.order_count],
              ["Lifetime Value", formatCurrency(customer.lifetime_value)],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-xs text-[#7a9e88]">{label}</p>
                <p className="text-sm font-medium text-[#e8f5e9] mt-0.5">{value as string}</p>
              </div>
            ))}
            <EditCustomerForm id={id} initial={{ name: customer.name, phone: customer.phone, address: customer.address }} />
          </div>
        </div>

        {/* Orders */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e3d2c]">
              <h2 className="text-sm font-semibold text-[#e8f5e9]">Order History</h2>
            </div>
            {orderList.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#7a9e88]">No orders yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e3d2c]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#7a9e88] uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#7a9e88] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#7a9e88] uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#7a9e88] uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orderList.map((order: any, i: number) => (
                    <tr key={order.id}
                      className={`border-b border-[#1e3d2c] hover:bg-[#162b20] transition-colors ${i === orderList.length - 1 ? "border-b-0" : ""}`}>
                      <td className="px-4 py-3 text-sm text-[#e8f5e9] capitalize">{order.type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[order.status] ?? "text-[#7a9e88] bg-[#7a9e88]/10"}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#e8f5e9]">{order.total_amount ? formatCurrency(order.total_amount) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#7a9e88]">{formatDate(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
