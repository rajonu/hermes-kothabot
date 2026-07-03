'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2, Trash2 } from 'lucide-react';

interface Props {
  id: string;
  initial: { name: string; phone: string | null; address: string | null };
}

export function EditCustomerForm({ id, initial }: Props) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: initial.name ?? '',
    phone: initial.phone ?? '',
    address: initial.address ?? '',
  });
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setEdit(false); router.refresh(); }
  });

  const del = () => {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    start(async () => {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/customers');
    });
  };

  if (!edit) {
    return (
      <div className="flex gap-2 mt-3">
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
    <div className="space-y-2 mt-3">
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name"
        className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone"
        className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
      <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address"
        className="w-full bg-[#162b20] border border-[#1e3d2c] rounded-lg px-3 py-2 text-sm text-[#e8f5e9]" />
      <div className="flex gap-2">
        <button onClick={save} disabled={pending} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold disabled:opacity-50">
          {pending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
        </button>
        <button onClick={() => setEdit(false)} className="px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white">Cancel</button>
      </div>
    </div>
  );
}
