'use client';

import { Download } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  type: string;
  total_amount: number | null;
  created_at: string;
  notes: string | null;
  customers?: { name: string | null; phone: string | null } | null;
  metadata?: Record<string, any> | null;
}

export function ExportButton({ orders, label }: { orders: Order[]; label: string }) {
  function download() {
    const rows = [
      ['ID', 'Customer', 'Phone', 'Type', 'Status', 'Amount', 'Date', 'Notes'],
      ...orders.map(o => [
        o.id,
        o.customers?.name ?? '',
        o.customers?.phone ?? '',
        o.type,
        o.status,
        o.total_amount ?? '',
        new Date(o.created_at).toLocaleString(),
        (o.notes ?? '').replace(/\n/g, ' '),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${label.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
    >
      <Download size={13} /> <span className="hidden sm:inline">Export</span>
    </button>
  );
}
