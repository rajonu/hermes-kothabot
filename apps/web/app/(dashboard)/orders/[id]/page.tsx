import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryNav } from "@/lib/category-nav";
import { EditOrderForm } from "./EditOrderForm";

function fmtWhen(s?: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function waLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('880') ? digits : `880${digits.replace(/^0/, '')}`}`;
}

const STATUS_STYLES: Record<string, string> = {
  pending:    "text-[#ffd740] bg-[#ffd740]/10 border-[#ffd740]/20",
  confirmed:  "text-[#00bcd4] bg-[#00bcd4]/10 border-[#00bcd4]/20",
  processing: "text-[#00e676] bg-[#00e676]/10 border-[#00e676]/20",
  completed:  "text-[#00e676] bg-[#00e676]/10 border-[#00e676]/20",
  cancelled:  "text-[#ff6b6b] bg-[#ff6b6b]/10 border-[#ff6b6b]/20",
};

const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "completed",
};

function parseNote(notes: string | null, field: string): string | null {
  if (!notes) return null;
  const m = notes.match(new RegExp(`${field}:\\s*([^|]+)`));
  return m?.[1]?.trim() ?? null;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await db.from("shops").select("id, category").eq("owner_id", user.id).single();

  const { data: order } = await db.from("orders")
    .select("*, customers(name, phone, address)")
    .eq("id", id)
    .eq("shop_id", shopRaw?.id)
    .single();

  if (!order) notFound();

  const category = (shopRaw as any)?.category ?? 'other';
  const catNav = getCategoryNav(category);
  const isClinic = category === 'clinic';
  const isBooking = category === 'salon' || category === 'services';
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] ?? {};
  const meta = {
    ...(order.metadata ?? {}),
    doctor_name:    firstItem.doctor_name    ?? (order.metadata as any)?.doctor_name,
    appointment_at: (order as any).starts_at ?? firstItem.appointment_at ?? (order.metadata as any)?.appointment_at,
    service_name:   firstItem.service_name   ?? (order.metadata as any)?.service_name,
    booking_at:     firstItem.booking_at     ?? (order.metadata as any)?.booking_at,
    patient_name:   (order.metadata as any)?.patient_name,
    patient_phone:  (order.metadata as any)?.patient_phone,
  };

  const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    booking_form: { label: 'Booking Form', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    voice:        { label: 'Voice',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    widget:       { label: 'Widget',        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    api:          { label: 'API',           color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
  };
  const sourceKey = (order.metadata as any)?._kothabot_origin as string | undefined;
  const sourceTag = sourceKey ? SOURCE_LABELS[sourceKey] ?? null : null;

  // Load the linked voice session transcript (if any)
  let transcript: { role: 'user' | 'assistant'; text: string; timestamp?: number }[] = [];
  if (order.session_id) {
    const { data: session } = await db
      .from("voice_sessions")
      .select("transcript")
      .eq("id", order.session_id)
      .single();
    if (Array.isArray(session?.transcript)) {
      transcript = session.transcript;
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/orders" className="flex items-center gap-1.5 text-xs text-[#7a9e88] hover:text-[#e8f5e9] transition-colors w-fit">
          <ArrowLeft size={13} /> Back to {catNav.ordersLabel}
        </Link>
      </div>

      <PageHeader
        title={isClinic ? `Appointment #${id.slice(0, 8).toUpperCase()}` : isBooking ? `Booking #${id.slice(0, 8).toUpperCase()}` : `Order #${id.slice(0, 8).toUpperCase()}`}
        description={`Created ${formatDate(order.created_at)}`}
        action={
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium capitalize px-3 py-1 rounded-full border ${STATUS_STYLES[order.status] ?? ""}`}>
              {order.status}
            </span>
            {sourceTag && (
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${sourceTag.color}`}>
                {sourceTag.label}
              </span>
            )}
            <EditOrderForm id={id} category={category} initial={{
              items, total_amount: order.total_amount, notes: order.notes, metadata: meta, status: order.status,
            }} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Appointment details (clinic) */}
          {isClinic && (
            <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#e8f5e9]">Appointment</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-[#7a9e88]">Doctor</p><p className="text-[#e8f5e9] mt-0.5">{meta.doctor_name ?? '—'}</p></div>
                <div><p className="text-xs text-[#7a9e88]">When</p><p className="text-[#e8f5e9] mt-0.5">{fmtWhen(meta.appointment_at) || '—'}</p></div>
                <div><p className="text-xs text-[#7a9e88]">Patient</p><p className="text-[#e8f5e9] mt-0.5">{meta.patient_name ?? order.customers?.name ?? '—'}</p></div>
              </div>
            </div>
          )}

          {/* Booking details (salon/services) */}
          {isBooking && (
            <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#e8f5e9]">Booking</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-[#7a9e88]">Service</p><p className="text-[#e8f5e9] mt-0.5">{meta.service_name ?? '—'}</p></div>
                <div><p className="text-xs text-[#7a9e88]">When</p><p className="text-[#e8f5e9] mt-0.5">{fmtWhen(meta.booking_at) || '—'}</p></div>
              </div>
            </div>
          )}

          {/* Items */}
          {!isClinic && !isBooking && (
          <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5">
            <h2 className="text-sm font-semibold text-[#e8f5e9] mb-4">Order Items</h2>
            {items.length === 0 ? (
              <p className="text-sm text-[#7a9e88]">No items recorded.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item: any, i: number) => {
                  const qty   = item.quantity ?? item.qty ?? 1;
                  const price = item.unit_price ?? item.price ?? null;
                  return (
                    <div key={i} className="flex justify-between p-3 rounded-lg bg-[#162b20] text-sm">
                      <div>
                        <span className="text-[#e8f5e9]">{item.name ?? 'Item'}</span>
                        {qty > 1 && <span className="text-[#7a9e88] ml-2 text-xs">×{qty}</span>}
                      </div>
                      {price && <span className="text-[#00e676] font-medium">{formatCurrency(price * qty)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {order.total_amount && (
              <div className="flex justify-between mt-4 pt-4 border-t border-[#1e3d2c]">
                <span className="text-sm font-semibold text-[#e8f5e9]">Total</span>
                <span className="text-sm font-bold text-[#00e676]">{formatCurrency(order.total_amount)}</span>
              </div>
            )}
          </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5">
              <h2 className="text-sm font-semibold text-[#e8f5e9] mb-2">Notes</h2>
              <p className="text-sm text-[#7a9e88]">{order.notes}</p>
            </div>
          )}

          {/* AI Conversation Transcript */}
          {transcript.length > 0 && (
            <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5">
              <h2 className="text-sm font-semibold text-[#e8f5e9] mb-4">AI Conversation</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {transcript.map((entry, i) => {
                  const isAssistant = entry.role === 'assistant';
                  return (
                    <div key={i} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isAssistant
                          ? 'bg-[#162b20] text-[#e8f5e9]'
                          : 'bg-[#00e676]/10 text-[#e8f5e9] border border-[#00e676]/20'
                      }`}>
                        <div className={`text-[10px] uppercase tracking-wide mb-0.5 ${
                          isAssistant ? 'text-[#7a9e88]' : 'text-[#00e676]'
                        }`}>
                          {isAssistant ? 'AI Assistant' : 'Customer'}
                        </div>
                        <p className="whitespace-pre-wrap">{entry.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer — from linked record OR parsed from notes */}
          <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5">
            <h2 className="text-sm font-semibold text-[#e8f5e9] mb-3">{catNav.customersLabel.replace(/s$/, '')}</h2>
            {(() => {
              const name    = order.customers?.name    ?? meta.patient_name  ?? parseNote(order.notes, 'Name');
              const phone   = order.customers?.phone   ?? meta.patient_phone ?? parseNote(order.notes, 'Phone');
              const address = order.customers?.address ?? parseNote(order.notes, 'Address');
              if (!name && !phone) return (
                <p className="text-sm text-[#7a9e88]">No customer info recorded.</p>
              );
              return (
                <div className="space-y-2 text-sm">
                  {name    && <div className="flex gap-2"><span className="text-[#3a5e48] w-16 shrink-0">Name</span><span className="text-[#e8f5e9] font-medium">{name}</span></div>}
                  {phone   && <div className="flex items-center gap-2 flex-wrap"><span className="text-[#3a5e48] w-16 shrink-0">Phone</span><span className="text-[#e8f5e9]">{phone}</span><a href={`tel:${phone.replace(/\s/g,'')}`} className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black text-[11px] font-bold transition-colors">📞 Call</a>{waLink(phone) && <a href={waLink(phone)!} target="_blank" rel="noopener" className="text-[#00e676] text-xs hover:underline">WhatsApp</a>}</div>}
                  {address && <div className="flex gap-2"><span className="text-[#3a5e48] w-16 shrink-0">Address</span><span className="text-[#e8f5e9]">{address}</span></div>}
                </div>
              );
            })()}
          </div>

          {/* Status update */}
          {NEXT_STATUS[order.status] && (
            <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5">
              <h2 className="text-sm font-semibold text-[#e8f5e9] mb-3">Update Status</h2>
              <form action={`/api/orders/${id}/status`} method="POST">
                <input type="hidden" name="status" value={NEXT_STATUS[order.status]} />
                <button type="submit"
                  className="w-full py-2 rounded-lg bg-[#00e676] text-[#09110e] text-sm font-semibold hover:bg-[#00e676]/90 transition-colors capitalize">
                  Mark as {NEXT_STATUS[order.status]}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
