'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2, Trash2, X } from 'lucide-react';

interface Item { name: string; quantity: number; unit_price: number | null; }

interface Props {
  id: string;
  category: string;
  initial: {
    items: Item[];
    total_amount: number | null;
    notes: string | null;
    metadata: any;
    status: string;
  };
}

const STATUSES = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];

export function EditOrderForm({ id, category, initial }: Props) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [items, setItems] = useState<Item[]>(Array.isArray(initial.items) ? initial.items : []);
  const [total, setTotal] = useState<string>(initial.total_amount?.toString() ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [status, setStatus] = useState(initial.status);
  const [meta, setMeta] = useState<any>(initial.metadata ?? {});
  const [pending, start] = useTransition();

  const isClinic = category === 'clinic';
  const isBooking = category === 'salon' || category === 'services';
  const isProductBased = !isClinic && !isBooking;

  const save = () => start(async () => {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: isProductBased ? items : [],
        total_amount: total ? parseFloat(total) : null,
        notes,
        status,
        metadata: meta,
      }),
    });
    if (res.ok) { setEdit(false); router.refresh(); }
  });

  const del = () => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    start(async () => {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/orders');
    });
  };

  if (!edit) {
    return (
      <div className="flex gap-2">
        <button onClick={() => setEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-white">
          <Pencil size={12} /> Edit
        </button>
        <button onClick={del} disabled={pending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10">
          <Trash2 size={12} /> Delete
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[#e8f5e9]">Edit</h3>

      {/* Status */}
      <div>
        <label className="block text-xs text-[#7a9e88] mb-1">Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9] capitalize">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isClinic && (
        <>
          <input value={meta?.doctor_name ?? ''} onChange={e => setMeta((m: any) => ({ ...m, doctor_name: e.target.value }))}
            placeholder="Doctor"
            className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
          <input value={meta?.appointment_at ?? ''} onChange={e => setMeta((m: any) => ({ ...m, appointment_at: e.target.value }))}
            placeholder="Appointment at (e.g. 2026-05-25 10:00)"
            className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
          <input value={meta?.patient_name ?? ''} onChange={e => setMeta((m: any) => ({ ...m, patient_name: e.target.value }))}
            placeholder="Patient"
            className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
        </>
      )}
      {isBooking && (
        <>
          <input value={meta?.service_name ?? ''} onChange={e => setMeta((m: any) => ({ ...m, service_name: e.target.value }))}
            placeholder="Service"
            className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
          <input value={meta?.booking_at ?? ''} onChange={e => setMeta((m: any) => ({ ...m, booking_at: e.target.value }))}
            placeholder="Booking at (e.g. 2026-05-25 10:00)"
            className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
        </>
      )}

      {isProductBased && (
        <div className="space-y-2">
          <label className="block text-xs text-[#7a9e88]">Items</label>
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={it.name} onChange={e => setItems(arr => arr.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                className="flex-1 bg-[#162b20] border border-[#1e3d2c] rounded-lg px-2 py-1.5 text-xs text-[#e8f5e9]" />
              <input type="number" value={it.quantity} onChange={e => setItems(arr => arr.map((x, idx) => idx === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))}
                className="w-16 bg-[#162b20] border border-[#1e3d2c] rounded-lg px-2 py-1.5 text-xs text-[#e8f5e9]" />
              <input type="number" step="0.01" value={it.unit_price ?? ''} onChange={e => setItems(arr => arr.map((x, idx) => idx === i ? { ...x, unit_price: e.target.value ? parseFloat(e.target.value) : null } : x))}
                className="w-20 bg-[#162b20] border border-[#1e3d2c] rounded-lg px-2 py-1.5 text-xs text-[#e8f5e9]" />
              <button onClick={() => setItems(arr => arr.filter((_, idx) => idx !== i))} className="p-1 text-gray-500 hover:text-red-400"><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => setItems(arr => [...arr, { name: '', quantity: 1, unit_price: null }])} className="text-xs text-emerald-400">+ Add item</button>
          <input type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} placeholder="Total amount"
            className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
        </div>
      )}

      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={2}
        className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9] resize-none" />

      <div className="flex gap-2">
        <button onClick={save} disabled={pending} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold disabled:opacity-50">
          {pending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
        </button>
        <button onClick={() => setEdit(false)} className="px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white">Cancel</button>
      </div>
    </div>
  );
}
