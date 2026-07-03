'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, X } from 'lucide-react';
import type { CategoryNav } from '@/lib/category-nav';

interface Product { id: string; name: string; price?: number | null; }

interface Props {
  category: string;
  products: Product[];
  catNav: CategoryNav;
}

interface Item { name: string; quantity: number; unit_price: number | null; }

export function NewOrderButton({ category, products, catNav }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    notes: '',
    // category-specific
    doctor_name: '',
    appointment_at: '',
    service_name: '',
    booking_at: '',
  });
  const [items, setItems] = useState<Item[]>([]);

  const isClinic = category === 'clinic';
  const isBooking = category === 'salon' || category === 'services';
  const isProductBased = !isClinic && !isBooking;

  const addItem = (p?: Product) => {
    setItems(arr => [...arr, { name: p?.name ?? '', quantity: 1, unit_price: p?.price ?? null }]);
  };

  const removeItem = (i: number) => setItems(arr => arr.filter((_, idx) => idx !== i));

  const updateItem = (i: number, patch: Partial<Item>) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const total = items.reduce((s, it) => s + (it.unit_price ?? 0) * (it.quantity || 0), 0);

  const submit = () => {
    setError(null);
    const metadata: any = {};
    if (isClinic) {
      if (!form.doctor_name || !form.appointment_at) { setError('Doctor and appointment time required'); return; }
      metadata.doctor_name = form.doctor_name;
      metadata.appointment_at = form.appointment_at;
      metadata.patient_name = form.customer_name;
    }
    if (isBooking) {
      if (!form.service_name || !form.booking_at) { setError('Service and booking time required'); return; }
      metadata.service_name = form.service_name;
      metadata.booking_at = form.booking_at;
    }
    if (isProductBased && items.length === 0) { setError('Add at least one item'); return; }
    if (!form.customer_name && !form.customer_phone) { setError('Customer name or phone required'); return; }

    start(async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: isProductBased ? items : [],
          total_amount: isProductBased ? (total || null) : null,
          metadata,
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return; }
      setOpen(false);
      router.refresh();
    });
  };

  const label = catNav.orderSingular.toLowerCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
      >
        <Plus size={14} /> Add {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-5 my-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4 capitalize">Add {label}</h3>
            <div className="space-y-3">
              {/* Customer */}
              <input
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                placeholder={`${catNav.customersLabel.replace(/s$/, '')} name *`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <input
                value={form.customer_phone}
                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                placeholder="Phone *"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              {!isClinic && (
                <input
                  value={form.customer_address}
                  onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                  placeholder="Delivery address (optional)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              )}

              {/* Category-specific */}
              {isClinic && (
                <>
                  <input
                    value={form.doctor_name}
                    onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))}
                    placeholder="Doctor name *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="datetime-local"
                    value={form.appointment_at}
                    onChange={e => setForm(f => ({ ...f, appointment_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </>
              )}
              {isBooking && (
                <>
                  <input
                    value={form.service_name}
                    onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
                    placeholder="Service name *"
                    list="service-list"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="service-list">
                    {products.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                  <input
                    type="datetime-local"
                    value={form.booking_at}
                    onChange={e => setForm(f => ({ ...f, booking_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </>
              )}

              {/* Product-based items */}
              {isProductBased && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">Items</label>
                    <select
                      onChange={e => {
                        const p = products.find(p => p.id === e.target.value);
                        if (p) addItem(p);
                        e.target.value = '';
                      }}
                      className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                      defaultValue=""
                    >
                      <option value="" disabled>+ Add from catalog</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.price ? `(৳${p.price})` : ''}</option>)}
                    </select>
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={it.name}
                        onChange={e => updateItem(i, { name: e.target.value })}
                        placeholder="Item"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={e => updateItem(i, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={it.unit_price ?? ''}
                        onChange={e => updateItem(i, { unit_price: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="Price"
                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                      <button onClick={() => removeItem(i)} className="p-1 text-gray-500 hover:text-red-400">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addItem()} className="text-xs text-emerald-400 hover:text-emerald-300">+ Add custom item</button>
                  {items.length > 0 && (
                    <p className="text-xs text-gray-400 text-right">Total: ৳{total.toFixed(2)}</p>
                  )}
                </div>
              )}

              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
              />

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={submit}
                  disabled={pending}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
                </button>
                <button onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
